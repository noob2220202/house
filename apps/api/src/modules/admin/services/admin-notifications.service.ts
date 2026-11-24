import {
  AGENCY_DOCUMENT_TYPE_LABEL,
  AgencyStatus,
  BANNER_SLOT_SPECS,
  DEAL_TYPE_LABEL,
  DealRequestStatus,
  DealRequestType,
  ErrorCode,
  OPEN_REPORT_STATUSES,
  ReportTargetType,
} from '@house/shared';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type Redis from 'ioredis';
import { AppException } from '../../../common/errors/app.exception';
import { decodeCursor, toCursorPage } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { InjectRedis } from '../../../redis/redis.constants';
import {
  ADMIN_NOTIFICATION_KINDS,
  type AdminNotificationKind,
  type AdminNotificationListQuery,
  type AdminNotificationPage,
  type AdminNotificationView,
} from '../schemas';
import { documentChecklist, listingHeadline, priceText, regionNames } from './admin-format';
import { toDashboardDealRequest } from './dashboard-queues.service';

const DAY_MS = 86_400_000;
const MIN_MS = 60_000;

/** The bell shows the last 30 days; older rows are purged after 90. */
export const NOTIFICATION_FEED_DAYS = 30;
export const NOTIFICATION_RETENTION_DAYS = 90;
/** Events older than this are not turned into notifications (first deploy, long outages). */
export const NOTIFICATION_SYNC_LOOKBACK_DAYS = 7;
/** A deal request still delivered to no office after this long is "waiting for assignment". */
export const UNASSIGNED_AFTER_MINUTES = 30;
/** Ads ending within this many days get an "광고 종료 N일 전" notification. */
export const AD_EXPIRING_NOTICE_DAYS = 3;
/** Lazy sync runs at most this often (GET /admin/notifications, GET /admin/dashboard). */
export const NOTIFICATION_SYNC_INTERVAL_SECONDS = 60;
const SYNC_LOCK_KEY = 'admin:notifications:sync';

export interface NotificationDraft {
  kind: AdminNotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  dedupeKey: string;
  createdAt: Date;
}

type NotificationRow = Prisma.AdminNotificationGetPayload<{
  include: { reads: { select: { readAt: true } } };
}>;

const asKind = (kind: string): AdminNotificationKind =>
  (ADMIN_NOTIFICATION_KINDS as readonly string[]).includes(kind)
    ? (kind as AdminNotificationKind)
    : 'SYSTEM';

function toView(row: NotificationRow): AdminNotificationView {
  return {
    id: row.id,
    kind: asKind(row.kind),
    title: row.title,
    body: row.body,
    link: row.link,
    createdAt: row.createdAt.toISOString(),
    readAt: row.reads[0]?.readAt.toISOString() ?? null,
  };
}

/** Whole KST calendar days from `now` until `end` (at least 1: "광고 종료 1일 전"). */
export function daysUntil(end: Date, now: Date): number {
  const KST = 9 * 3_600_000;
  const day = (d: Date) => Math.floor((d.getTime() + KST) / DAY_MS);
  return Math.max(1, day(end) - day(now));
}

const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * The back-office bell. Notifications are shared by every admin (read state per admin) and are
 * derived from the source tables — new agency applications, new open reports, deal requests no
 * office received, ads about to end — by `sync()`, which runs lazily (throttled to once a minute)
 * when the feed or the dashboard is read and from the admin-maintenance job. `dedupeKey` keeps
 * every event to one row, so re-running the sync is harmless.
 */
@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ---------- read side ----------

  async list(
    adminId: string,
    q: AdminNotificationListQuery,
    now = new Date(),
  ): Promise<AdminNotificationPage> {
    await this.syncThrottled(now);
    const feed = this.feedWhere(now);
    const where: Prisma.AdminNotificationWhereInput = {
      AND: [
        feed,
        q.unreadOnly ? { reads: { none: { adminUserId: adminId } } } : {},
        this.cursorWhere(q.cursor),
      ],
    };
    const [rows, unreadCount] = await Promise.all([
      this.prisma.adminNotification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: q.limit + 1,
        include: { reads: { where: { adminUserId: adminId }, select: { readAt: true } } },
      }),
      this.unreadCount(adminId, now),
    ]);
    const page = toCursorPage(rows, q.limit, (r) => `${r.createdAt.toISOString()}|${r.id}`);
    return { items: page.items.map(toView), nextCursor: page.nextCursor, unreadCount };
  }

  unreadCount(adminId: string, now = new Date()): Promise<number> {
    return this.prisma.adminNotification.count({
      where: { ...this.feedWhere(now), reads: { none: { adminUserId: adminId } } },
    });
  }

  async markRead(
    adminId: string,
    id: string,
    now = new Date(),
  ): Promise<{ id: string; unreadCount: number }> {
    const exists = await this.prisma.adminNotification.findFirst({
      where: { id, ...this.feedWhere(now) },
      select: { id: true },
    });
    if (!exists) {
      throw new AppException(ErrorCode.NOT_FOUND, { message: '알림을 찾을 수 없습니다.' });
    }
    await this.prisma.adminNotificationRead.createMany({
      data: [{ notificationId: id, adminUserId: adminId }],
      skipDuplicates: true,
    });
    return { id, unreadCount: await this.unreadCount(adminId, now) };
  }

  async markAllRead(
    adminId: string,
    now = new Date(),
  ): Promise<{ updated: number; unreadCount: number }> {
    const since = new Date(now.getTime() - NOTIFICATION_FEED_DAYS * DAY_MS);
    const updated = await this.prisma.$executeRaw`
      INSERT INTO admin_notification_reads (notification_id, admin_user_id, read_at)
      SELECT n.id, ${adminId}::uuid, now()
      FROM admin_notifications n
      WHERE n.created_at >= ${since}
      ON CONFLICT DO NOTHING`;
    return { updated, unreadCount: 0 };
  }

  private feedWhere(now: Date): Prisma.AdminNotificationWhereInput {
    return { createdAt: { gte: new Date(now.getTime() - NOTIFICATION_FEED_DAYS * DAY_MS) } };
  }

  /** Keyset cursor `<createdAt ISO>|<id>` (opaque base64url); an unreadable cursor starts over. */
  private cursorWhere(cursor: string | undefined): Prisma.AdminNotificationWhereInput {
    const raw = decodeCursor(cursor);
    if (!raw) return {};
    const [iso, id] = raw.split('|');
    const at = iso ? new Date(iso) : null;
    if (!at || Number.isNaN(at.getTime()) || !id || !/^[0-9a-f-]{36}$/i.test(id)) return {};
    return { OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] };
  }

  // ---------- write side ----------

  /** `sync()` at most once per NOTIFICATION_SYNC_INTERVAL_SECONDS; never fails the caller. */
  async syncThrottled(now = new Date()): Promise<void> {
    try {
      const got = await this.redis.set(
        SYNC_LOCK_KEY,
        '1',
        'EX',
        NOTIFICATION_SYNC_INTERVAL_SECONDS,
        'NX',
      );
      if (got !== 'OK') return;
      await this.sync(now);
    } catch (err) {
      this.logger.warn({ err }, 'admin notification sync failed');
    }
  }

  /** Turns recent events into notifications (idempotent). Returns the number of new rows. */
  async sync(now = new Date()): Promise<number> {
    const since = new Date(now.getTime() - NOTIFICATION_SYNC_LOOKBACK_DAYS * DAY_MS);
    const drafts = (
      await Promise.all([
        this.agencyApplications(since),
        this.receivedReports(since),
        this.unassignedDealRequests(since, now),
        this.expiringAds(now),
      ])
    ).flat();
    if (drafts.length === 0) return 0;
    const { count } = await this.prisma.adminNotification.createMany({
      data: drafts.map((d) => ({
        kind: d.kind,
        title: cut(d.title, 200),
        body: d.body ? cut(d.body, 1000) : null,
        link: d.link,
        dedupeKey: d.dedupeKey,
        createdAt: d.createdAt,
      })),
      skipDuplicates: true,
    });
    return count;
  }

  /** Deletes notifications (and their read markers) past the retention period. */
  async purgeExpired(now = new Date()): Promise<number> {
    const { count } = await this.prisma.adminNotification.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * DAY_MS) } },
    });
    return count;
  }

  private async agencyApplications(since: Date): Promise<NotificationDraft[]> {
    const rows = await this.prisma.agency.findMany({
      where: { deletedAt: null, status: AgencyStatus.PENDING, createdAt: { gte: since } },
      select: {
        id: true,
        name: true,
        representativeName: true,
        createdAt: true,
        documents: { select: { type: true } },
      },
    });
    return rows.map((a) => {
      const docs = documentChecklist(a.documents.map((d) => d.type));
      const complete = docs.missing.length === 0;
      const docText = complete
        ? `서류 ${new Set(a.documents.map((d) => d.type)).size}종 확인`
        : `${docs.missing.map((t) => AGENCY_DOCUMENT_TYPE_LABEL[t]).join(' · ')} 누락`;
      return {
        kind: 'AGENCY_APPLIED',
        title: complete ? '중개사무소 승인 요청' : '서류 보완이 필요한 승인 요청',
        body: `${a.name} · 대표 ${a.representativeName} · ${docText}`,
        link: `/agencies/${a.id}`,
        dedupeKey: `agency-applied:${a.id}`,
        createdAt: a.createdAt,
      };
    });
  }

  private async receivedReports(since: Date): Promise<NotificationDraft[]> {
    const open = { status: { in: [...OPEN_REPORT_STATUSES] } };
    const rows = await this.prisma.report.findMany({
      where: { ...open, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      take: 500,
      select: {
        id: true,
        targetType: true,
        listingId: true,
        agencyId: true,
        createdAt: true,
        listing: {
          select: {
            title: true,
            dealType: true,
            salePrice: true,
            presalePrice: true,
            deposit: true,
            monthlyRent: true,
            exclusiveArea: true,
            complex: { select: { name: true } },
            property: { select: { buildingName: true, roadAddress: true } },
            primaryAgency: { select: { name: true } },
          },
        },
        agency: { select: { name: true } },
      },
    });
    if (rows.length === 0) return [];
    // Position of each report among the open reports of its target ("2건째").
    const targetKey = (r: {
      targetType: string;
      listingId: string | null;
      agencyId: string | null;
    }) => (r.targetType === ReportTargetType.LISTING ? `L:${r.listingId}` : `A:${r.agencyId}`);
    const seen = new Map<string, number>();
    const olderOpen = await this.olderOpenCounts(rows, since);
    return rows.map((r) => {
      const key = targetKey(r);
      const nth = (olderOpen.get(key) ?? 0) + (seen.get(key) ?? 0) + 1;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      const l = r.listing;
      const subject = l
        ? [listingHeadline(l), priceText(l.dealType, l, DEAL_TYPE_LABEL)].filter(Boolean).join(' ')
        : (r.agency?.name ?? '신고 대상');
      const office = l?.primaryAgency.name ?? (l ? r.agency?.name : null);
      return {
        kind: 'REPORT_RECEIVED',
        title: nth > 1 ? `허위매물 신고가 접수됐어요 (${nth}건째)` : '허위매물 신고가 접수됐어요',
        body: office ? `${subject} · ${office}` : subject,
        link: `/reports/${r.id}`,
        dedupeKey: `report:${r.id}`,
        createdAt: r.createdAt,
      };
    });
  }

  /** Open reports filed before `since` per target (so "N건째" counts them too). */
  private async olderOpenCounts(
    rows: { targetType: string; listingId: string | null; agencyId: string | null }[],
    since: Date,
  ): Promise<Map<string, number>> {
    const listingIds = [...new Set(rows.map((r) => r.listingId).filter((x): x is string => !!x))];
    const agencyIds = [
      ...new Set(
        rows
          .filter((r) => r.targetType === ReportTargetType.AGENCY)
          .map((r) => r.agencyId)
          .filter((x): x is string => !!x),
      ),
    ];
    const out = new Map<string, number>();
    const base = { status: { in: [...OPEN_REPORT_STATUSES] }, createdAt: { lt: since } };
    if (listingIds.length) {
      const g = await this.prisma.report.groupBy({
        by: ['listingId'],
        where: { ...base, targetType: ReportTargetType.LISTING, listingId: { in: listingIds } },
        _count: { _all: true },
      });
      for (const c of g) out.set(`L:${c.listingId}`, c._count._all);
    }
    if (agencyIds.length) {
      const g = await this.prisma.report.groupBy({
        by: ['agencyId'],
        where: { ...base, targetType: ReportTargetType.AGENCY, agencyId: { in: agencyIds } },
        _count: { _all: true },
      });
      for (const c of g) out.set(`A:${c.agencyId}`, c._count._all);
    }
    return out;
  }

  private async unassignedDealRequests(since: Date, now: Date): Promise<NotificationDraft[]> {
    const before = new Date(now.getTime() - UNASSIGNED_AFTER_MINUTES * MIN_MS);
    if (before <= since) return [];
    const rows = await this.prisma.dealRequest.findMany({
      where: {
        deletedAt: null,
        status: DealRequestStatus.OPEN,
        createdAt: { gte: since, lte: before },
        targets: { none: {} },
      },
      take: 200,
      select: {
        id: true,
        type: true,
        dealTypes: true,
        emdCode: true,
        regionCodes: true,
        complexIds: true,
        exclusiveArea: true,
        areaMin: true,
        areaMax: true,
        floor: true,
        moveInDate: true,
        desiredSalePrice: true,
        desiredDeposit: true,
        desiredMonthlyRent: true,
        priceMax: true,
        depositMax: true,
        rentMax: true,
        createdAt: true,
        complex: { select: { name: true } },
        _count: { select: { targets: true, proposals: true } },
      },
    });
    if (rows.length === 0) return [];
    const complexIds = [...new Set(rows.flatMap((r) => r.complexIds))];
    const [names, complexes] = await Promise.all([
      regionNames(
        this.prisma,
        rows.flatMap((r) => [r.emdCode, ...r.regionCodes]),
      ),
      complexIds.length
        ? this.prisma.complex.findMany({
            where: { id: { in: complexIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const complexNames = new Map(complexes.map((c) => [c.id, c.name]));
    return rows.map((r) => {
      const row = toDashboardDealRequest(r, names, complexNames);
      const price = priceText(
        row.dealType,
        { salePrice: row.price, deposit: row.deposit, monthlyRent: row.monthlyRent },
        DEAL_TYPE_LABEL,
      );
      const sell = r.type === DealRequestType.SELL_OR_LEASE;
      return {
        kind: 'DEAL_REQUEST_UNASSIGNED',
        title: `${sell ? '내놓기' : '구하기'} 요청이 배정을 기다리고 있어요`,
        body: [row.title, price].filter(Boolean).join(' · '),
        link: `/deal-requests/${r.id}`,
        dedupeKey: `deal-request-unassigned:${r.id}`,
        createdAt: new Date(r.createdAt.getTime() + UNASSIGNED_AFTER_MINUTES * MIN_MS),
      };
    });
  }

  private async expiringAds(now: Date): Promise<NotificationDraft[]> {
    const soon = new Date(now.getTime() + AD_EXPIRING_NOTICE_DAYS * DAY_MS);
    const live = {
      deletedAt: null,
      paused: false,
      startAt: { lte: now },
      endAt: { gt: now, lte: soon },
    };
    const [banners, popups] = await Promise.all([
      this.prisma.banner.findMany({
        where: live,
        take: 200,
        select: {
          id: true,
          title: true,
          advertiserName: true,
          slot: true,
          endAt: true,
          agency: { select: { name: true } },
        },
      }),
      this.prisma.popup.findMany({
        where: live,
        take: 200,
        select: { id: true, title: true, endAt: true },
      }),
    ]);
    // Dated when the notice window opened (never in the future); the end date is part of the
    // key, so extending an ad re-arms the notice for the new end.
    const openedAt = (end: Date) =>
      new Date(Math.min(now.getTime(), end.getTime() - AD_EXPIRING_NOTICE_DAYS * DAY_MS));
    return [
      ...banners.map(
        (b): NotificationDraft => ({
          kind: 'AD_EXPIRING',
          title: `광고 종료 ${daysUntil(b.endAt, now)}일 전`,
          body: `${b.advertiserName ?? b.agency?.name ?? b.title} · ${BANNER_SLOT_SPECS[b.slot].label}`,
          link: `/banners?edit=${b.id}`,
          dedupeKey: `ad-expiring:banner:${b.id}:${b.endAt.toISOString()}`,
          createdAt: openedAt(b.endAt),
        }),
      ),
      ...popups.map(
        (p): NotificationDraft => ({
          kind: 'AD_EXPIRING',
          title: `팝업 종료 ${daysUntil(p.endAt, now)}일 전`,
          body: p.title,
          link: `/banners/popups?edit=${p.id}`,
          dedupeKey: `ad-expiring:popup:${p.id}:${p.endAt.toISOString()}`,
          createdAt: openedAt(p.endAt),
        }),
      ),
    ];
  }
}
