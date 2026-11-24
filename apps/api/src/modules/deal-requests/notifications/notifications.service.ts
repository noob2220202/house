import type {
  CursorPage,
  NotificationReadInput,
  NotificationReadResult,
  NotificationType,
  NotificationView,
} from '@house/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { decodeCursor, toCursorPage } from '../../../common/pagination/pagination';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { DealRequestMapper } from '../deal-request.mapper';
import { notificationSelect } from '../deal-request.selects';
import {
  NOTIFICATION_DISPATCHER,
  type DispatchableNotification,
  type NotificationDispatcher,
} from './notification-dispatcher';
import {
  LISTING_AGENCY_NOTIFICATION_TYPES,
  notificationScopeWhere,
  type NotificationFeedQuery,
  type NotificationScope,
} from './notification-scope';

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  /** Deep-link ids only — never contact or other PII. */
  data?: Prisma.InputJsonObject;
}

/** A recipient addressed as a member of an agency: the row gets `data.agencyId` (B5). */
export interface MemberRecipient {
  userId: string;
  agencyId: string;
}

/** The feed page plus the unread count of the same scope (the web badges read it from here). */
export interface NotificationFeedPage extends CursorPage<NotificationView> {
  unreadCount: number;
}

/**
 * In-app notifications (the `notifications` table) for the current user, plus the write side
 * used by deal-request flows. Writes join the caller's transaction; external delivery happens via
 * `dispatch()` after commit.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: DealRequestMapper,
    @Inject(NOTIFICATION_DISPATCHER) private readonly dispatcher: NotificationDispatcher,
  ) {}

  /**
   * One notification per distinct user id (personal audience). Listing notices addressed to an
   * agency (LISTING_HIDDEN …) get `data.agencyId` of the listing's primary agency.
   */
  async createFor(
    userIds: readonly string[],
    input: NotificationInput,
    db: PrismaTx = this.prisma,
  ): Promise<DispatchableNotification[]> {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return [];
    return this.createEach(
      ids.map((userId) => ({ ...input, userId })),
      db,
    );
  }

  /**
   * One notification per member of an agency (deduplicated by user, first agency wins): every row
   * carries `data.agencyId`, so the console and the my-page can tell agency events apart (B5).
   */
  async createForMembers(
    recipients: readonly MemberRecipient[],
    input: NotificationInput,
    db: PrismaTx = this.prisma,
  ): Promise<DispatchableNotification[]> {
    const byUser = new Map<string, string>();
    for (const r of recipients) if (!byUser.has(r.userId)) byUser.set(r.userId, r.agencyId);
    if (byUser.size === 0) return [];
    return this.createEach(
      [...byUser].map(([userId, agencyId]) => ({
        ...input,
        userId,
        data: { ...input.data, agencyId },
      })),
      db,
    );
  }

  /** One notification per item (per-recipient payloads). */
  async createEach(
    items: readonly (NotificationInput & { userId: string })[],
    db: PrismaTx = this.prisma,
  ): Promise<DispatchableNotification[]> {
    if (items.length === 0) return [];
    const withAgency = await this.withListingAgency(items, db);
    return db.notification.createManyAndReturn({
      data: withAgency.map((i) => ({
        userId: i.userId,
        type: i.type,
        title: i.title,
        body: i.body ?? null,
        data: i.data ?? undefined,
      })),
      select: { id: true, userId: true, type: true, title: true, body: true },
    });
  }

  /**
   * Listing notices written by other modules (admin hide, report resolution) carry only
   * `listingId`; they are addressed to the primary agency's owner, so add its `agencyId`.
   */
  private async withListingAgency<T extends NotificationInput>(
    items: readonly T[],
    db: PrismaTx,
  ): Promise<T[]> {
    const listingIdOf = (i: T): string | null => {
      if (!LISTING_AGENCY_NOTIFICATION_TYPES.includes(i.type)) return null;
      if (typeof i.data?.agencyId === 'string') return null;
      const id = i.data?.listingId;
      return typeof id === 'string' ? id : null;
    };
    const listingIds = [...new Set(items.map(listingIdOf).filter((v): v is string => !!v))];
    if (listingIds.length === 0) return [...items];
    const rows = await db.listing.findMany({
      where: { id: { in: listingIds } },
      select: { id: true, primaryAgencyId: true },
    });
    const agencyOf = new Map(rows.map((r) => [r.id, r.primaryAgencyId]));
    return items.map((i) => {
      const listingId = listingIdOf(i);
      const agencyId = listingId ? agencyOf.get(listingId) : undefined;
      return agencyId ? { ...i, data: { ...i.data, agencyId } } : i;
    });
  }

  /** Best-effort external delivery; never fails the caller. */
  async dispatch(rows: readonly DispatchableNotification[]): Promise<void> {
    if (rows.length === 0) return;
    try {
      await this.dispatcher.dispatch(rows);
    } catch (err) {
      this.logger.warn({ err, count: rows.length }, 'notification dispatch failed');
    }
  }

  async list(userId: string, q: NotificationFeedQuery): Promise<NotificationFeedPage> {
    const cursor = parseCursor(decodeCursor(q.cursor));
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...notificationScopeWhere(q.scope),
      ...(q.unreadOnly ? { readAt: null } : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    };
    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        select: notificationSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: q.limit + 1,
      }),
      this.unreadCount(userId, q.scope),
    ]);
    const page = toCursorPage(rows, q.limit, (r) => `${r.createdAt.toISOString()}|${r.id}`);
    return {
      items: page.items.map((n) => this.mapper.notification(n)),
      nextCursor: page.nextCursor,
      unreadCount,
    };
  }

  /** Unread rows of the user, optionally of one audience (same filter as the feed). */
  unreadCount(userId: string, scope?: NotificationScope): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null, ...notificationScopeWhere(scope) },
    });
  }

  /**
   * Marks `ids` (or all) read. With `scope`, `all` only covers that audience and `unread` is the
   * count of that audience, so the console's "모두 읽음" never touches the personal feed.
   */
  async markRead(
    userId: string,
    input: NotificationReadInput,
    scope?: NotificationScope,
    now: Date = new Date(),
  ): Promise<NotificationReadResult> {
    const { count } = await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
        ...(input.ids ? { id: { in: input.ids } } : notificationScopeWhere(scope)),
      },
      data: { readAt: now },
    });
    return { updated: count, unread: await this.unreadCount(userId, scope) };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "<iso>|<uuid>" → keyset position; malformed cursors restart from the top. */
export function parseCursor(raw: string | null): { createdAt: Date; id: string } | null {
  if (!raw) return null;
  const sep = raw.lastIndexOf('|');
  if (sep < 0) return null;
  const createdAt = new Date(raw.slice(0, sep));
  const id = raw.slice(sep + 1);
  if (Number.isNaN(createdAt.getTime()) || !UUID.test(id)) return null;
  return { createdAt, id };
}
