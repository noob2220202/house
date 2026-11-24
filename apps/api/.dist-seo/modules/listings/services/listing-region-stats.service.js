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
exports.ListingRegionStatsService = exports.PerPyeongBasis = void 0;
exports.emptyDealCounts = emptyDealCounts;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../prisma/prisma.service");
const listing_search_repository_1 = require("../listing-search.repository");
/**
 * Which listings an average 평당가 (만원/평) is computed from — only where Korean listings are
 * compared that way: 아파트 (공급 평당, 전용 when 공급 is unknown), 토지 (대지 평당), 상가 (전용 평당).
 */
exports.PerPyeongBasis = {
    APT: 'APT',
    LAND: 'LAND',
    COMMERCIAL: 'COMMERCIAL',
};
const REGION_KEY_SQL = client_1.Prisma.sql `(CASE WHEN length(l.emd_code) = 10 AND right(l.emd_code, 2) = '00'
  THEN left(l.emd_code, 8) ELSE l.emd_code END)`;
const HAS_REGION_SQL = client_1.Prisma.sql `l.emd_code ~ '^[0-9]{8}([0-9]{2})?$'`;
const PUBLIC_SQL = client_1.Prisma.sql `l.deleted_at IS NULL AND ${listing_search_repository_1.PUBLIC_STATUS_SQL} AND ${listing_search_repository_1.PRIMARY_AGENCY_APPROVED_SQL}`;
const PER_PYEONG_SQL = {
    APT: { asset: shared_1.AssetType.APT, area: client_1.Prisma.sql `COALESCE(p.supply_area, l.exclusive_area)` },
    LAND: { asset: shared_1.AssetType.LAND, area: client_1.Prisma.sql `p.land_area` },
    COMMERCIAL: { asset: shared_1.AssetType.COMMERCIAL, area: client_1.Prisma.sql `l.exclusive_area` },
};
const DEAL_KEY = {
    PRESALE: 'presale',
    SALE: 'sale',
    JEONSE: 'jeonse',
    MONTHLY: 'monthly',
};
function emptyDealCounts() {
    return { presale: 0, sale: 0, jeonse: 0, monthly: 0 };
}
/**
 * Read-only aggregates over publicly visible listings per 지역 (home 지역 현황 / 많이 찾는 지역).
 * Same disclosure rule as public search: 광고중/계약중, not deleted, approved primary agency.
 */
let ListingRegionStatsService = class ListingRegionStatsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** Listing counts per 지역 (and deal type) within the 시군구, optionally for some asset types. */
    async regionStats(sggCode, assetTypes) {
        const typeFilter = assetTypes?.length
            ? client_1.Prisma.sql `AND l.asset_type = ANY(${[...assetTypes]}::asset_type[])`
            : client_1.Prisma.empty;
        const rows = await this.prisma.$queryRaw `
      SELECT ${REGION_KEY_SQL} AS "regionKey", l.deal_type::text AS "dealType",
        count(*)::int AS "count", sum(l.lat)::float AS "latSum", sum(l.lng)::float AS "lngSum"
      FROM listings l
      WHERE ${PUBLIC_SQL} AND l.sgg_code = ${sggCode} AND ${HAS_REGION_SQL} ${typeFilter}
      GROUP BY 1, 2`;
        const byKey = new Map();
        for (const r of rows) {
            const stat = byKey.get(r.regionKey) ?? {
                regionKey: r.regionKey,
                listingCount: 0,
                dealCounts: emptyDealCounts(),
                lat: 0,
                lng: 0,
                latSum: 0,
                lngSum: 0,
            };
            stat.listingCount += r.count;
            stat.dealCounts[DEAL_KEY[r.dealType]] += r.count;
            stat.latSum += r.latSum;
            stat.lngSum += r.lngSum;
            byKey.set(r.regionKey, stat);
        }
        return [...byKey.values()].map(({ latSum, lngSum, ...s }) => ({
            ...s,
            lat: latSum / s.listingCount,
            lng: lngSum / s.listingCount,
        }));
    }
    /** Average 매매 평당가 (만원/평, rounded) per 지역 for one basis. */
    async perPyeongByRegion(sggCode, basis) {
        const { asset, area } = PER_PYEONG_SQL[basis];
        const rows = await this.prisma.$queryRaw `
      SELECT ${REGION_KEY_SQL} AS "regionKey",
        avg(l.price_sort / (${area} / ${shared_1.SQM_PER_PYEONG}))::float AS "perPyeong"
      FROM listings l JOIN properties p ON p.id = l.property_id
      WHERE ${PUBLIC_SQL} AND l.sgg_code = ${sggCode} AND ${HAS_REGION_SQL}
        AND l.deal_type = ${shared_1.DealType.SALE}::deal_type AND l.asset_type = ${asset}::asset_type
        AND l.price_sort > 0 AND ${area} > 0
      GROUP BY 1`;
        return new Map(rows.flatMap((r) => r.perPyeong !== null && Number.isFinite(r.perPyeong)
            ? [[r.regionKey, Math.round(r.perPyeong)]]
            : []));
    }
    /** City-wide counters of the home hero. */
    async totals(sggCode, verifiedSince) {
        const rows = await this.prisma.$queryRaw `
      SELECT l.asset_type::text AS "assetType", count(*)::int AS "count",
        (count(*) FILTER (WHERE l.verified_at >= ${verifiedSince}))::int AS "verified"
      FROM listings l
      WHERE ${PUBLIC_SQL} AND l.sgg_code = ${sggCode}
      GROUP BY 1`;
        const assetTypeCounts = Object.fromEntries((0, shared_1.enumValues)(shared_1.AssetType).map((t) => [t, 0]));
        let listingCount = 0;
        let verifiedCount = 0;
        for (const r of rows) {
            assetTypeCounts[r.assetType] = r.count;
            listingCount += r.count;
            verifiedCount += r.verified;
        }
        return { listingCount, assetTypeCounts, verifiedCount };
    }
};
exports.ListingRegionStatsService = ListingRegionStatsService;
exports.ListingRegionStatsService = ListingRegionStatsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ListingRegionStatsService);
//# sourceMappingURL=listing-region-stats.service.js.map