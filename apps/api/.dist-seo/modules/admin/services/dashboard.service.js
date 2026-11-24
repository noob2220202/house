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
exports.DashboardService = void 0;
exports.startOfKstDay = startOfKstDay;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../../../common/cache/cache.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../constants");
const visitor_stats_service_1 = require("../visitors/visitor-stats.service");
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
const ENDING_SOON_LIMIT = 10;
const ALL_REPORT_STATUSES = Object.values(shared_1.ReportStatus);
const ALL_USER_STATUSES = Object.values(shared_1.UserStatus);
/** 00:00 KST of the day containing `now`, as a UTC instant. */
function startOfKstDay(now) {
    const kst = now.getTime() + KST_OFFSET_MS;
    return new Date(Math.floor(kst / DAY_MS) * DAY_MS - KST_OFFSET_MS);
}
/**
 * Back-office dashboard: counters across modules (read-only COUNTs on indexed columns) plus the
 * visitor HyperLogLogs. Cached briefly — it is polled by every open admin tab.
 */
let DashboardService = class DashboardService {
    constructor(prisma, cache, visitors) {
        this.prisma = prisma;
        this.cache = cache;
        this.visitors = visitors;
    }
    get(now = new Date()) {
        return this.cache.getOrSet('cache:admin:dashboard', constants_1.DASHBOARD_CACHE_TTL_SECONDS, () => this.compute(now));
    }
    async compute(now = new Date()) {
        const today = startOfKstDay(now);
        const soon = new Date(now.getTime() + shared_1.ADS_ENDING_SOON_DAYS * DAY_MS);
        const liveBannerWhere = {
            deletedAt: null,
            paused: false,
            startAt: { lte: now },
            endAt: { gt: now, lte: soon },
        };
        const db = this.prisma;
        const [visitors, newListings, activeListings, hiddenListings, newDealRequests, openDealRequests, pendingAgencies, approvedAgencies, openReports, newReports, newMembers, totalMembers, suspendedMembers, endingSoon, endingSoonCount,] = await Promise.all([
            this.visitors.lastDays(7, now),
            db.listing.count({
                where: {
                    deletedAt: null,
                    status: { in: [...shared_1.PUBLIC_LISTING_STATUSES] },
                    publishedAt: { gte: today },
                },
            }),
            db.listing.count({
                where: { deletedAt: null, status: { in: [...shared_1.PUBLIC_LISTING_STATUSES] } },
            }),
            db.listing.count({ where: { deletedAt: null, status: shared_1.ListingStatus.HIDDEN } }),
            db.dealRequest.count({ where: { createdAt: { gte: today } } }),
            db.dealRequest.count({ where: { status: shared_1.DealRequestStatus.OPEN } }),
            db.agency.count({ where: { deletedAt: null, status: shared_1.AgencyStatus.PENDING } }),
            db.agency.count({ where: { deletedAt: null, status: shared_1.AgencyStatus.APPROVED } }),
            db.report.count({ where: { status: { in: [...shared_1.OPEN_REPORT_STATUSES] } } }),
            // `status IN (all)` lets Postgres use the (status, created_at) indexes for the date range.
            db.report.count({
                where: { status: { in: ALL_REPORT_STATUSES }, createdAt: { gte: today } },
            }),
            db.user.count({ where: { status: { in: ALL_USER_STATUSES }, createdAt: { gte: today } } }),
            db.user.count({ where: { status: { not: shared_1.UserStatus.WITHDRAWN } } }),
            db.user.count({ where: { status: shared_1.UserStatus.SUSPENDED } }),
            db.banner.findMany({
                where: liveBannerWhere,
                orderBy: { endAt: 'asc' },
                take: ENDING_SOON_LIMIT,
                select: { id: true, title: true, slot: true, endAt: true },
            }),
            db.banner.count({ where: liveBannerWhere }),
        ]);
        const daily = visitors.daily;
        return {
            generatedAt: now.toISOString(),
            visitors: {
                today: daily[daily.length - 1]?.count ?? 0,
                yesterday: daily[daily.length - 2]?.count ?? 0,
                last7Days: daily,
                uniqueLast7Days: visitors.unique,
            },
            listings: { newToday: newListings, active: activeListings, hidden: hiddenListings },
            dealRequests: { newToday: newDealRequests, open: openDealRequests },
            agencies: { pending: pendingAgencies, approved: approvedAgencies },
            reports: { open: openReports, newToday: newReports },
            members: { newToday: newMembers, total: totalMembers, suspended: suspendedMembers },
            ads: {
                endingSoon: endingSoon.map((b) => ({
                    id: b.id,
                    title: b.title,
                    slot: b.slot,
                    endAt: b.endAt.toISOString(),
                })),
                endingSoonCount,
            },
        };
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        visitor_stats_service_1.VisitorStatsService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map