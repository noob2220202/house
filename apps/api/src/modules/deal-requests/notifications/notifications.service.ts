import type {
  CursorPage,
  NotificationListQuery,
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

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  /** Deep-link ids only — never contact or other PII. */
  data?: Prisma.InputJsonObject;
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

  /** One notification per distinct user id. */
  async createFor(
    userIds: readonly string[],
    input: NotificationInput,
    db: PrismaTx = this.prisma,
  ): Promise<DispatchableNotification[]> {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return [];
    return db.notification.createManyAndReturn({
      data: ids.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        data: input.data ?? undefined,
      })),
      select: { id: true, userId: true, type: true, title: true, body: true },
    });
  }

  /** One notification per item (per-recipient payloads). */
  async createEach(
    items: readonly (NotificationInput & { userId: string })[],
    db: PrismaTx = this.prisma,
  ): Promise<DispatchableNotification[]> {
    if (items.length === 0) return [];
    return db.notification.createManyAndReturn({
      data: items.map((i) => ({
        userId: i.userId,
        type: i.type,
        title: i.title,
        body: i.body ?? null,
        data: i.data ?? undefined,
      })),
      select: { id: true, userId: true, type: true, title: true, body: true },
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

  async list(userId: string, q: NotificationListQuery): Promise<CursorPage<NotificationView>> {
    const cursor = parseCursor(decodeCursor(q.cursor));
    const where: Prisma.NotificationWhereInput = {
      userId,
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
    const rows = await this.prisma.notification.findMany({
      where,
      select: notificationSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
    });
    const page = toCursorPage(rows, q.limit, (r) => `${r.createdAt.toISOString()}|${r.id}`);
    return {
      items: page.items.map((n) => this.mapper.notification(n)),
      nextCursor: page.nextCursor,
    };
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(
    userId: string,
    input: NotificationReadInput,
    now: Date = new Date(),
  ): Promise<NotificationReadResult> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(input.ids ? { id: { in: input.ids } } : {}) },
      data: { readAt: now },
    });
    return { updated: count, unread: await this.unreadCount(userId) };
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
