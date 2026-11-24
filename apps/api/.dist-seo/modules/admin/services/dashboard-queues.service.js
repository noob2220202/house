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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardQueuesService = exports.QUEUE_PREVIEW = void 0;
exports.startOfKstWeek = startOfKstWeek;
exports.averageHandleHours = averageHandleHours;
exports.ctrOf = ctrOf;
exports.toDashboardDealRequest = toDashboardDealRequest;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../../../common/cache/cache.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const media_service_1 = require("../../media/media.service");
const constants_1 = require("../constants");
const admin_format_1 = require("./admin-format");
const dashboard_service_1 = require("./dashboard.service");
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
/** Rows previewed per dashboard panel. */
exports.QUEUE_PREVIEW = 5;
const ACTIVE_PROPOSAL_STATUSES = [
    shared_1.ProposalStatus.SENT,
    shared_1.ProposalStatus.VIEWED,
    shared_1.ProposalStatus.ACCEPTED,
];
const OPEN_DEAL_REQUEST_STATUSES = [shared_1.DealRequestStatus.OPEN, shared_1.DealRequestStatus.MATCHED];
/** 00:00 KST of the Monday of the week containing `now`. */
function startOfKstWeek(now) {
    const day = (0, dashboard_service_1.startOfKstDay)(now);
    const kstDow = new Date(day.getTime() + 9 * HOUR_MS).getUTCDay(); // 0 = Sunday
    const sinceMonday = (kstDow + 6) % 7;
    return new Date(day.getTime() - sinceMonday * DAY_MS);
}
/** Average report handling time in hours (one decimal), null when nothing was handled. */
function averageHandleHours(rows) {
    const spans = rows
        .filter((r) => r.handledAt !== null)
        .map((r) => Math.max(0, r.handledAt.getTime() - r.createdAt.getTime()));
    if (spans.length === 0)
        return null;
    const avg = spans.reduce((a, b) => a + b, 0) / spans.length / HOUR_MS;
    return Math.round(avg * 10) / 10;
}
/** Click-through rate 0–1 (4 decimals), null without impressions. */
function ctrOf(impressions, clicks) {
    if (impressions <= 0)
        return null;
    return Math.min(1, Math.round((clicks / impressions) * 10_000) / 10_000);
}
const dealRequestSelect = {
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
    _count: {
        select: {
            targets: true,
            proposals: { where: { status: { in: ACTIVE_PROPOSAL_STATUSES } } },
        },
    },
};
/**
 * GET /admin/dashboard/queues — the work queues previewed on the dashboard: pending agency
 * applications (oldest first), open deal requests (newest first), open reports grouped by target
 * (newest first, with this week's handling stats) and ads ending within ADS_ENDING_SOON_DAYS.
 * Same data for every admin, so it is cached briefly like the dashboard counters.
 */
let DashboardQueuesService = class DashboardQueuesService {
    constructor(prisma, cache, media) {
        this.prisma = prisma;
        this.cache = cache;
        this.media = media;
    }
    get(now = new Date()) {
        return this.cache.getOrSet('cache:admin:dashboard:queues', constants_1.DASHBOARD_CACHE_TTL_SECONDS, () => this.compute(now));
    }
    async compute(now = new Date()) {
        const [pendingAgencies, dealRequests, reports, expiringAds] = await Promise.all([
            this.pendingAgencies(),
            this.dealRequests(),
            this.reports(now),
            this.expiringAds(now),
        ]);
        return { pendingAgencies, dealRequests, reports, expiringAds };
    }
    async pendingAgencies() {
        const where = { deletedAt: null, status: shared_1.AgencyStatus.PENDING };
        const [rows, total] = await Promise.all([
            this.prisma.agency.findMany({
                where,
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                take: exports.QUEUE_PREVIEW,
                select: {
                    id: true,
                    name: true,
                    representativeName: true,
                    registrationNumber: true,
                    status: true,
                    emdCode: true,
                    createdAt: true,
                    documents: { select: { type: true } },
                },
            }),
            this.prisma.agency.count({ where }),
        ]);
        const names = await (0, admin_format_1.regionNames)(this.prisma, rows.map((r) => r.emdCode));
        const items = rows.map((a) => ({
            id: a.id,
            name: a.name,
            areaName: (a.emdCode && names.get(a.emdCode)) || null,
            representativeName: a.representativeName,
            registrationNumber: a.registrationNumber,
            status: a.status,
            appliedAt: a.createdAt.toISOString(),
            documents: (0, admin_format_1.documentChecklist)(a.documents.map((d) => d.type)),
            registryStatus: null,
        }));
        return { total, items };
    }
    async dealRequests() {
        const where = {
            deletedAt: null,
            status: { in: OPEN_DEAL_REQUEST_STATUSES },
        };
        const [rows, total] = await Promise.all([
            this.prisma.dealRequest.findMany({
                where,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                take: exports.QUEUE_PREVIEW,
                select: dealRequestSelect,
            }),
            this.prisma.dealRequest.count({ where }),
        ]);
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
        const items = rows.map((r) => toDashboardDealRequest(r, names, complexNames));
        return { total, items };
    }
    async reports(now) {
        const open = { status: { in: [...shared_1.OPEN_REPORT_STATUSES] } };
        const weekStart = startOfKstWeek(now);
        const [groups, handled] = await Promise.all([
            this.prisma.report.groupBy({
                by: ['targetType', 'listingId', 'agencyId'],
                where: open,
                _count: { _all: true },
                _max: { createdAt: true },
                orderBy: { _max: { createdAt: 'desc' } },
            }),
            this.prisma.report.findMany({
                where: {
                    status: { in: [shared_1.ReportStatus.RESOLVED, shared_1.ReportStatus.REJECTED] },
                    handledAt: { gte: weekStart },
                },
                select: { createdAt: true, handledAt: true },
            }),
        ]);
        const preview = groups.slice(0, exports.QUEUE_PREVIEW);
        const items = await Promise.all(preview.map(async (g) => {
            const newest = await this.prisma.report.findFirst({
                where: {
                    ...open,
                    targetType: g.targetType,
                    listingId: g.listingId,
                    agencyId: g.agencyId,
                },
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                select: {
                    id: true,
                    reason: true,
                    createdAt: true,
                    listing: {
                        select: {
                            id: true,
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
                    agency: { select: { id: true, name: true } },
                },
            });
            if (!newest)
                return null;
            const isListing = g.targetType === shared_1.ReportTargetType.LISTING;
            const targetId = (isListing ? g.listingId : g.agencyId) ?? newest.id;
            return {
                id: newest.id,
                targetType: g.targetType,
                targetId,
                reason: newest.reason,
                title: isListing
                    ? newest.listing
                        ? (0, admin_format_1.listingHeadline)(newest.listing)
                        : '삭제된 매물'
                    : (newest.agency?.name ?? '삭제된 중개사무소'),
                agencyName: newest.listing?.primaryAgency.name ?? newest.agency?.name ?? null,
                reportCount: g._count._all,
                lastReportedAt: (g._max.createdAt ?? newest.createdAt).toISOString(),
            };
        }));
        return {
            total: groups.length,
            items: items.filter((i) => i !== null),
            handledThisWeek: handled.length,
            avgHandleHours: averageHandleHours(handled),
        };
    }
    async expiringAds(now) {
        const soon = new Date(now.getTime() + shared_1.ADS_ENDING_SOON_DAYS * DAY_MS);
        const live = {
            deletedAt: null,
            paused: false,
            startAt: { lte: now },
            endAt: { gt: now, lte: soon },
        };
        const mediaRef = { select: { storageKey: true, variants: true } };
        const [banners, bannerCount, popups, popupCount] = await Promise.all([
            this.prisma.banner.findMany({
                where: live,
                orderBy: [{ endAt: 'asc' }, { id: 'asc' }],
                take: exports.QUEUE_PREVIEW,
                select: {
                    id: true,
                    title: true,
                    advertiserName: true,
                    slot: true,
                    endAt: true,
                    agency: { select: { name: true } },
                    pcMedia: mediaRef,
                },
            }),
            this.prisma.banner.count({ where: live }),
            this.prisma.popup.findMany({
                where: live,
                orderBy: [{ endAt: 'asc' }, { id: 'asc' }],
                take: exports.QUEUE_PREVIEW,
                select: { id: true, title: true, endAt: true, media: mediaRef },
            }),
            this.prisma.popup.count({ where: live }),
        ]);
        const stats = banners.length
            ? await this.prisma.bannerStatDaily.groupBy({
                by: ['bannerId'],
                where: { bannerId: { in: banners.map((b) => b.id) } },
                _sum: { impressions: true, clicks: true },
            })
            : [];
        const byBanner = new Map(stats.map((s) => [s.bannerId, s._sum]));
        const all = [
            ...banners.map((b) => {
                const s = byBanner.get(b.id);
                return {
                    id: b.id,
                    kind: 'BANNER',
                    advertiserName: b.advertiserName ?? b.agency?.name ?? b.title,
                    slot: b.slot,
                    placementLabel: null,
                    endAt: b.endAt.toISOString(),
                    ctr: ctrOf(s?.impressions ?? 0, s?.clicks ?? 0),
                    imageUrl: this.media.url(b.pcMedia, 'thumb'),
                };
            }),
            ...popups.map((p) => ({
                id: p.id,
                kind: 'POPUP',
                advertiserName: p.title,
                slot: null,
                placementLabel: '팝업',
                endAt: p.endAt.toISOString(),
                ctr: null,
                imageUrl: this.media.url(p.media, 'thumb'),
            })),
        ];
        all.sort((a, b) => a.endAt.localeCompare(b.endAt) || a.id.localeCompare(b.id));
        return { total: bannerCount + popupCount, items: all.slice(0, exports.QUEUE_PREVIEW) };
    }
};
exports.DashboardQueuesService = DashboardQueuesService;
exports.DashboardQueuesService = DashboardQueuesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        media_service_1.MediaService])
], DashboardQueuesService);
/** One deal request as a dashboard row ("신대 레이크파크 1단지 · 34평", price, condition). */
function toDashboardDealRequest(r, regions, complexNames) {
    const dealType = r.dealTypes[0] ?? shared_1.DealType.SALE;
    const sell = r.type === shared_1.DealRequestType.SELL_OR_LEASE;
    const place = sell
        ? (r.complex?.name ?? (r.emdCode ? regions.get(r.emdCode) : undefined))
        : (r.complexIds.map((id) => complexNames.get(id)).find(Boolean) ??
            r.regionCodes.map((c) => regions.get(c)).find(Boolean));
    const size = (0, admin_format_1.pyeongLabel)(sell ? r.exclusiveArea : (r.areaMin ?? r.areaMax));
    const title = [place ?? '순천시 전체', size].filter(Boolean).join(' · ');
    const prices = sell
        ? (0, admin_format_1.priceFields)(dealType, {
            salePrice: r.desiredSalePrice,
            presalePrice: r.desiredSalePrice,
            deposit: r.desiredDeposit,
            monthlyRent: r.desiredMonthlyRent,
        })
        : (0, admin_format_1.priceFields)(dealType, {
            salePrice: r.priceMax,
            presalePrice: r.priceMax,
            deposit: r.depositMax,
            monthlyRent: r.rentMax,
        });
    let note = null;
    if (sell && r.floor != null)
        note = `${r.floor}층`;
    if (!sell && r.moveInDate) {
        const d = r.moveInDate;
        note = `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 입주`;
    }
    return {
        id: r.id,
        type: r.type,
        title,
        dealType,
        ...prices,
        note,
        createdAt: r.createdAt.toISOString(),
        deliveredAgencyCount: r._count.targets,
        activeProposalCount: r._count.proposals,
    };
}
//# sourceMappingURL=dashboard-queues.service.js.map