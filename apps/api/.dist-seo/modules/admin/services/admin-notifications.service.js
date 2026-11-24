"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AdminNotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminNotificationsService = exports.NOTIFICATION_SYNC_INTERVAL_SECONDS = exports.AD_EXPIRING_NOTICE_DAYS = exports.UNASSIGNED_AFTER_MINUTES = exports.NOTIFICATION_SYNC_LOOKBACK_DAYS = exports.NOTIFICATION_RETENTION_DAYS = exports.NOTIFICATION_FEED_DAYS = void 0;
exports.daysUntil = daysUntil;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const redis_constants_1 = require("../../../redis/redis.constants");
const schemas_1 = require("../schemas");
const admin_format_1 = require("./admin-format");
const dashboard_queues_service_1 = require("./dashboard-queues.service");
const DAY_MS = 86_400_000;
const MIN_MS = 60_000;
/** The bell shows the last 30 days; older rows are purged after 90. */
exports.NOTIFICATION_FEED_DAYS = 30;
exports.NOTIFICATION_RETENTION_DAYS = 90;
/** Events older than this are not turned into notifications (first deploy, long outages). */
exports.NOTIFICATION_SYNC_LOOKBACK_DAYS = 7;
/** A deal request still delivered to no office after this long is "waiting for assignment". */
exports.UNASSIGNED_AFTER_MINUTES = 30;
/** Ads ending within this many days get an "광고 종료 N일 전" notification. */
exports.AD_EXPIRING_NOTICE_DAYS = 3;
/** Lazy sync runs at most this often (GET /admin/notifications, GET /admin/dashboard). */
exports.NOTIFICATION_SYNC_INTERVAL_SECONDS = 60;
const SYNC_LOCK_KEY = 'admin:notifications:sync';
const asKind = (kind) => schemas_1.ADMIN_NOTIFICATION_KINDS.includes(kind)
    ? kind
    : 'SYSTEM';
function toView(row) {
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
function daysUntil(end, now) {
    const KST = 9 * 3_600_000;
    const day = (d) => Math.floor((d.getTime() + KST) / DAY_MS);
    return Math.max(1, day(end) - day(now));
}
const cut = (s, max) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
/**
 * The back-office bell. Notifications are shared by every admin (read state per admin) and are
 * derived from the source tables — new agency applications, new open reports, deal requests no
 * office received, ads about to end — by `sync()`, which runs lazily (throttled to once a minute)
 * when the feed or the dashboard is read and from the admin-maintenance job. `dedupeKey` keeps
 * every event to one row, so re-running the sync is harmless.
 */
let AdminNotificationsService = AdminNotificationsService_1 = class AdminNotificationsService {
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
        this.logger = new common_1.Logger(AdminNotificationsService_1.name);
    }
    // ---------- read side ----------
    async list(adminId, q, now = new Date()) {
        await this.syncThrottled(now);
        const feed = this.feedWhere(now);
        const where = {
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
        const page = (0, pagination_1.toCursorPage)(rows, q.limit, (r) => `${r.createdAt.toISOString()}|${r.id}`);
        return { items: page.items.map(toView), nextCursor: page.nextCursor, unreadCount };
    }
    unreadCount(adminId, now = new Date()) {
        return this.prisma.adminNotification.count({
            where: { ...this.feedWhere(now), reads: { none: { adminUserId: adminId } } },
        });
    }
    async markRead(adminId, id, now = new Date()) {
        const exists = await this.prisma.adminNotification.findFirst({
            where: { id, ...this.feedWhere(now) },
            select: { id: true },
        });
        if (!exists) {
            throw new app_exception_1.AppException(shared_1.ErrorCode.NOT_FOUND, { message: '알림을 찾을 수 없습니다.' });
        }
        await this.prisma.adminNotificationRead.createMany({
            data: [{ notificationId: id, adminUserId: adminId }],
            skipDuplicates: true,
        });
        return { id, unreadCount: await this.unreadCount(adminId, now) };
    }
    async markAllRead(adminId, now = new Date()) {
        const since = new Date(now.getTime() - exports.NOTIFICATION_FEED_DAYS * DAY_MS);
        const updated = await this.prisma.$executeRaw `
      INSERT INTO admin_notification_reads (notification_id, admin_user_id, read_at)
      SELECT n.id, ${adminId}::uuid, now()
      FROM admin_notifications n
      WHERE n.created_at >= ${since}
      ON CONFLICT DO NOTHING`;
        return { updated, unreadCount: 0 };
    }
    feedWhere(now) {
        return { createdAt: { gte: new Date(now.getTime() - exports.NOTIFICATION_FEED_DAYS * DAY_MS) } };
    }
    /** Keyset cursor `<createdAt ISO>|<id>` (opaque base64url); an unreadable cursor starts over. */
    cursorWhere(cursor) {
        const raw = (0, pagination_1.decodeCursor)(cursor);
        if (!raw)
            return {};
        const [iso, id] = raw.split('|');
        const at = iso ? new Date(iso) : null;
        if (!at || Number.isNaN(at.getTime()) || !id || !/^[0-9a-f-]{36}$/i.test(id))
            return {};
        return { OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] };
    }
    // ---------- write side ----------
    /** `sync()` at most once per NOTIFICATION_SYNC_INTERVAL_SECONDS; never fails the caller. */
    async syncThrottled(now = new Date()) {
        try {
            const got = await this.redis.set(SYNC_LOCK_KEY, '1', 'EX', exports.NOTIFICATION_SYNC_INTERVAL_SECONDS, 'NX');
            if (got !== 'OK')
                return;
            await this.sync(now);
        }
        catch (err) {
            this.logger.warn({ err }, 'admin notification sync failed');
        }
    }
    /** Turns recent events into notifications (idempotent). Returns the number of new rows. */
    async sync(now = new Date()) {
        const since = new Date(now.getTime() - exports.NOTIFICATION_SYNC_LOOKBACK_DAYS * DAY_MS);
        const drafts = (await Promise.all([
            this.agencyApplications(since),
            this.receivedReports(since),
            this.unassignedDealRequests(since, now),
            this.expiringAds(now),
        ])).flat();
        if (drafts.length === 0)
            return 0;
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
    async purgeExpired(now = new Date()) {
        const { count } = await this.prisma.adminNotification.deleteMany({
            where: { createdAt: { lt: new Date(now.getTime() - exports.NOTIFICATION_RETENTION_DAYS * DAY_MS) } },
        });
        return count;
    }
    async agencyApplications(since) {
        const rows = await this.prisma.agency.findMany({
            where: { deletedAt: null, status: shared_1.AgencyStatus.PENDING, createdAt: { gte: since } },
            select: {
                id: true,
                name: true,
                representativeName: true,
                createdAt: true,
                documents: { select: { type: true } },
            },
        });
        return rows.map((a) => {
            const docs = (0, admin_format_1.documentChecklist)(a.documents.map((d) => d.type));
            const complete = docs.missing.length === 0;
            const docText = complete
                ? `서류 ${new Set(a.documents.map((d) => d.type)).size}종 확인`
                : `${docs.missing.map((t) => shared_1.AGENCY_DOCUMENT_TYPE_LABEL[t]).join(' · ')} 누락`;
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
    async receivedReports(since) {
        const open = { status: { in: [...shared_1.OPEN_REPORT_STATUSES] } };
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
        if (rows.length === 0)
            return [];
        // Position of each report among the open reports of its target ("2건째").
        const targetKey = (r) => (r.targetType === shared_1.ReportTargetType.LISTING ? `L:${r.listingId}` : `A:${r.agencyId}`);
        const seen = new Map();
        const olderOpen = await this.olderOpenCounts(rows, since);
        return rows.map((r) => {
            const key = targetKey(r);
            const nth = (olderOpen.get(key) ?? 0) + (seen.get(key) ?? 0) + 1;
            seen.set(key, (seen.get(key) ?? 0) + 1);
            const l = r.listing;
            const subject = l
                ? [(0, admin_format_1.listingHeadline)(l), (0, admin_format_1.priceText)(l.dealType, l, shared_1.DEAL_TYPE_LABEL)].filter(Boolean).join(' ')
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
    async olderOpenCounts(rows, since) {
        const listingIds = [...new Set(rows.map((r) => r.listingId).filter((x) => !!x))];
        const agencyIds = [
            ...new Set(rows
                .filter((r) => r.targetType === shared_1.ReportTargetType.AGENCY)
                .map((r) => r.agencyId)
                .filter((x) => !!x)),
        ];
        const out = new Map();
        const base = { status: { in: [...shared_1.OPEN_REPORT_STATUSES] }, createdAt: { lt: since } };
        if (listingIds.length) {
            const g = await this.prisma.report.groupBy({
                by: ['listingId'],
                where: { ...base, targetType: shared_1.ReportTargetType.LISTING, listingId: { in: listingIds } },
                _count: { _all: true },
            });
            for (const c of g)
                out.set(`L:${c.listingId}`, c._count._all);
        }
        if (agencyIds.length) {
            const g = await this.prisma.report.groupBy({
                by: ['agencyId'],
                where: { ...base, targetType: shared_1.ReportTargetType.AGENCY, agencyId: { in: agencyIds } },
                _count: { _all: true },
            });
            for (const c of g)
                out.set(`A:${c.agencyId}`, c._count._all);
        }
        return out;
    }
    async unassignedDealRequests(since, now) {
        const before = new Date(now.getTime() - exports.UNASSIGNED_AFTER_MINUTES * MIN_MS);
        if (before <= since)
            return [];
        const rows = await this.prisma.dealRequest.findMany({
            where: {
                deletedAt: null,
                status: shared_1.DealRequestStatus.OPEN,
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
        if (rows.length === 0)
            return [];
        const complexIds = [...new Set(rows.flatMap((r) => r.complexIds))];
        const [names, complexes] = await Promise.all([
            (0, admin_format_1.regionNames)(this.prisma, rows.flatMap((r) => [r.emdCode, ...r.regionCodes])),
            complexIds.length
                ? this.prisma.complex.findMany({
                    where: { id: { in: complexIds } },
                    select: { id: true, name: true },
                })
                : Promise.resolve([]),
        ]);
        const complexNames = new Map(complexes.map((c) => [c.id, c.name]));
        return rows.map((r) => {
            const row = (0, dashboard_queues_service_1.toDashboardDealRequest)(r, names, complexNames);
            const price = (0, admin_format_1.priceText)(row.dealType, { salePrice: row.price, deposit: row.deposit, monthlyRent: row.monthlyRent }, shared_1.DEAL_TYPE_LABEL);
            const sell = r.type === shared_1.DealRequestType.SELL_OR_LEASE;
            return {
                kind: 'DEAL_REQUEST_UNASSIGNED',
                title: `${sell ? '내놓기' : '구하기'} 요청이 배정을 기다리고 있어요`,
                body: [row.title, price].filter(Boolean).join(' · '),
                link: `/deal-requests/${r.id}`,
                dedupeKey: `deal-request-unassigned:${r.id}`,
                createdAt: new Date(r.createdAt.getTime() + exports.UNASSIGNED_AFTER_MINUTES * MIN_MS),
            };
        });
    }
    async expiringAds(now) {
        const soon = new Date(now.getTime() + exports.AD_EXPIRING_NOTICE_DAYS * DAY_MS);
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
        const openedAt = (end) => new Date(Math.min(now.getTime(), end.getTime() - exports.AD_EXPIRING_NOTICE_DAYS * DAY_MS));
        return [
            ...banners.map((b) => ({
                kind: 'AD_EXPIRING',
                title: `광고 종료 ${daysUntil(b.endAt, now)}일 전`,
                body: `${b.advertiserName ?? b.agency?.name ?? b.title} · ${shared_1.BANNER_SLOT_SPECS[b.slot].label}`,
                link: `/banners?edit=${b.id}`,
                dedupeKey: `ad-expiring:banner:${b.id}:${b.endAt.toISOString()}`,
                createdAt: openedAt(b.endAt),
            })),
            ...popups.map((p) => ({
                kind: 'AD_EXPIRING',
                title: `팝업 종료 ${daysUntil(p.endAt, now)}일 전`,
                body: p.title,
                link: `/banners/popups?edit=${p.id}`,
                dedupeKey: `ad-expiring:popup:${p.id}:${p.endAt.toISOString()}`,
                createdAt: openedAt(p.endAt),
            })),
        ];
    }
};
exports.AdminNotificationsService = AdminNotificationsService;
exports.AdminNotificationsService = AdminNotificationsService = AdminNotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, redis_constants_1.InjectRedis)()),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Function])
], AdminNotificationsService);
//# sourceMappingURL=admin-notifications.service.js.map