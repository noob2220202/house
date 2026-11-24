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
exports.HomeStatsService = void 0;
exports.perPyeongBasisFor = perPyeongBasisFor;
exports.viewsFor = viewsFor;
exports.rankRegions = rankRegions;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../../../common/cache/cache.service");
const app_config_service_1 = require("../../../config/app-config.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const regions_service_1 = require("../../complexes/services/regions.service");
const listing_region_stats_service_1 = require("../../listings/services/listing-region-stats.service");
const listing_views_service_1 = require("../../listings/services/listing-views.service");
const dates_1 = require("../../listings/domain/dates");
const constants_1 = require("../constants");
const region_info_1 = require("../domain/region-info");
/**
 * Basis of the 평당가 for a category selection (web mock `perPyeongFor`): 아파트 whenever all
 * categories or 아파트 are selected, else 토지, else 상가; 원룸·주택 alone → none.
 */
function perPyeongBasisFor(assetTypes) {
    if (!assetTypes?.length || assetTypes.includes(shared_1.AssetType.APT))
        return listing_region_stats_service_1.PerPyeongBasis.APT;
    if (assetTypes.includes(shared_1.AssetType.LAND))
        return listing_region_stats_service_1.PerPyeongBasis.LAND;
    if (assetTypes.includes(shared_1.AssetType.COMMERCIAL))
        return listing_region_stats_service_1.PerPyeongBasis.COMMERCIAL;
    return null;
}
/** Views of the selected categories per region key. */
function viewsFor(views, assetTypes) {
    const out = new Map();
    for (const [key, byType] of views) {
        let n = 0;
        for (const [type, count] of byType) {
            if (!assetTypes?.length || assetTypes.includes(type))
                n += count;
        }
        if (n > 0)
            out.set(key, n);
    }
    return out;
}
/**
 * Ranks region keys by this week's views (ties: more listings, then key) and computes the rank
 * change against last week's ranking of the same candidates (null when unranked last week).
 */
function rankRegions(candidates, thisWeek, lastWeek) {
    const prevRank = new Map(candidates
        .filter((c) => (lastWeek.get(c.key) ?? 0) > 0)
        .sort((a, b) => (lastWeek.get(b.key) ?? 0) - (lastWeek.get(a.key) ?? 0) ||
        b.listingCount - a.listingCount ||
        a.key.localeCompare(b.key))
        .map((c, i) => [c.key, i + 1]));
    return [...candidates]
        .sort((a, b) => (thisWeek.get(b.key) ?? 0) - (thisWeek.get(a.key) ?? 0) ||
        b.listingCount - a.listingCount ||
        a.key.localeCompare(b.key))
        .map((c, i) => {
        const prev = prevRank.get(c.key);
        return {
            key: c.key,
            rank: i + 1,
            rankDelta: prev === undefined ? null : prev - (i + 1),
            weeklyViewCount: thisWeek.get(c.key) ?? 0,
        };
    });
}
/** Home hero counters and the 지역 ranking, from public listings + region view counters. */
let HomeStatsService = class HomeStatsService {
    constructor(prisma, cache, config, regions, stats, views) {
        this.prisma = prisma;
        this.cache = cache;
        this.config = config;
        this.regions = regions;
        this.stats = stats;
        this.views = views;
    }
    get sggCode() {
        return this.config.get('REGION_SGG_CODE');
    }
    summary(now = new Date()) {
        return this.cache.getOrSet(`cache:home:summary:${this.sggCode}`, constants_1.HOME_CACHE_TTL_SECONDS.SUMMARY, () => this.computeSummary(now));
    }
    popularRegions(q, now = new Date()) {
        const types = [...new Set(q.assetTypes ?? [])].sort();
        return this.cache.getOrSet(`cache:home:popular-regions:${this.sggCode}:${(0, shared_1.kstDayKey)(now)}:${types.join(',') || '-'}:${q.limit}`, constants_1.HOME_CACHE_TTL_SECONDS.POPULAR_REGIONS, () => this.computePopularRegions(types, q.limit, now));
    }
    /** Display name of the service 시군구 ("순천시"). */
    async regionName() {
        const row = await this.prisma.region.findUnique({
            where: { code: this.sggCode },
            select: { name: true },
        });
        if (row)
            return row.name;
        return this.sggCode === shared_1.DEFAULT_SGG_CODE
            ? (shared_1.DEFAULT_REGION_NAME.split(' ').pop() ?? null)
            : null;
    }
    async regionIndex() {
        return (0, region_info_1.regionInfoIndex)(await this.regions.activeSubRegions());
    }
    async computeSummary(now) {
        const sgg = this.sggCode;
        const [regionName, totals, agencyCount, regionStats, perPyeong, index] = await Promise.all([
            this.regionName(),
            this.stats.totals(sgg, (0, dates_1.kstDayStart)((0, dates_1.kstToday)(now))),
            this.prisma.agency.count({
                where: { status: shared_1.AgencyStatus.APPROVED, deletedAt: null, sggCode: sgg },
            }),
            this.stats.regionStats(sgg),
            this.stats.perPyeongByRegion(sgg, listing_region_stats_service_1.PerPyeongBasis.APT),
            this.regionIndex(),
        ]);
        const regions = regionStats
            .sort((a, b) => b.listingCount - a.listingCount || a.regionKey.localeCompare(b.regionKey))
            .map((s) => {
            const info = index.get(s.regionKey);
            return {
                code: s.regionKey,
                name: info?.name ?? s.regionKey,
                emdName: info?.emdName ?? null,
                lat: info?.lat ?? s.lat,
                lng: info?.lng ?? s.lng,
                listingCount: s.listingCount,
                avgPricePerPyeong: perPyeong.get(s.regionKey) ?? null,
            };
        });
        return {
            regionName,
            listingCount: totals.listingCount,
            agencyCount,
            verifiedTodayCount: totals.verifiedCount,
            assetTypeCounts: totals.assetTypeCounts,
            regions,
            updatedAt: now.toISOString(),
        };
    }
    async computePopularRegions(assetTypes, limit, now) {
        const sgg = this.sggCode;
        const basis = perPyeongBasisFor(assetTypes);
        const [regionStats, perPyeong, thisWeek, lastWeek, index] = await Promise.all([
            this.stats.regionStats(sgg, assetTypes),
            basis ? this.stats.perPyeongByRegion(sgg, basis) : Promise.resolve(new Map()),
            this.views.regionViews(0, 6, now),
            this.views.regionViews(7, 13, now),
            this.regionIndex(),
        ]);
        const byKey = new Map(regionStats.map((s) => [s.regionKey, s]));
        const ranked = rankRegions(regionStats.map((s) => ({ key: s.regionKey, listingCount: s.listingCount })), viewsFor(thisWeek, assetTypes), viewsFor(lastWeek, assetTypes)).slice(0, limit);
        const items = ranked.flatMap((r) => {
            const s = byKey.get(r.key);
            if (!s)
                return [];
            const info = index.get(r.key);
            return [
                {
                    rank: r.rank,
                    code: r.key,
                    name: info?.name ?? r.key,
                    emdName: info?.emdName ?? null,
                    lat: info?.lat ?? s.lat,
                    lng: info?.lng ?? s.lng,
                    listingCount: s.listingCount,
                    dealCounts: s.dealCounts,
                    avgPricePerPyeong: basis ? (perPyeong.get(r.key) ?? null) : null,
                    weeklyViewCount: r.weeklyViewCount,
                    rankDelta: r.rankDelta,
                },
            ];
        });
        return { items, updatedAt: now.toISOString() };
    }
};
exports.HomeStatsService = HomeStatsService;
exports.HomeStatsService = HomeStatsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        app_config_service_1.AppConfig,
        regions_service_1.RegionsService,
        listing_region_stats_service_1.ListingRegionStatsService,
        listing_views_service_1.ListingViewsService])
], HomeStatsService);
//# sourceMappingURL=home-stats.service.js.map