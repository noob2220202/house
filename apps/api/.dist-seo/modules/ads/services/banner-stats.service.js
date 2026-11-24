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
exports.BannerStatsService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/errors/app.exception");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../constants");
const ad_tracking_service_1 = require("./ad-tracking.service");
/** Daily impressions/clicks/CTR of one banner: flushed DB rows merged with live Redis counts. */
let BannerStatsService = class BannerStatsService {
    constructor(prisma, tracking) {
        this.prisma = prisma;
        this.tracking = tracking;
    }
    async forBanner(bannerId, q, now = new Date()) {
        const banner = await this.prisma.banner.findFirst({
            where: { id: bannerId, deletedAt: null },
            select: { id: true },
        });
        if (!banner)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.BANNER_NOT_FOUND);
        const to = q.to ?? (0, shared_1.kstDate)(now);
        const from = q.from ?? (0, shared_1.addDays)(to, -(constants_1.BANNER_STATS_DEFAULT_DAYS - 1));
        if (from > to || (0, shared_1.daysBetween)(from, to) > shared_1.ADS_LIMITS.STATS_MAX_DAYS) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.BANNER_STATS_RANGE_INVALID, {
                maxDays: shared_1.ADS_LIMITS.STATS_MAX_DAYS,
            });
        }
        const days = (0, shared_1.dateRange)(from, to);
        const recent = new Set(this.tracking.recentDates(now));
        const [rows, live] = await Promise.all([
            this.prisma.bannerStatDaily.findMany({
                where: {
                    bannerId,
                    date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) },
                },
                select: { date: true, impressions: true, clicks: true },
            }),
            this.tracking.liveCounts(bannerId, days.filter((d) => recent.has(d))),
        ]);
        const stored = new Map(rows.map((r) => [r.date.toISOString().slice(0, 10), r]));
        let impressions = 0;
        let clicks = 0;
        const daily = days.map((date) => {
            const db = stored.get(date);
            const rd = live.get(date);
            // Redis sets only grow during their day, so the larger value is the freshest total.
            const imp = Math.max(db?.impressions ?? 0, rd?.impressions ?? 0);
            const clk = Math.max(db?.clicks ?? 0, rd?.clicks ?? 0);
            impressions += imp;
            clicks += clk;
            return { date, impressions: imp, clicks: clk, ctr: (0, shared_1.ctrPercent)(clk, imp) };
        });
        return {
            bannerId,
            from,
            to,
            totals: { impressions, clicks, ctr: (0, shared_1.ctrPercent)(clicks, impressions) },
            daily,
        };
    }
};
exports.BannerStatsService = BannerStatsService;
exports.BannerStatsService = BannerStatsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ad_tracking_service_1.AdTrackingService])
], BannerStatsService);
//# sourceMappingURL=banner-stats.service.js.map