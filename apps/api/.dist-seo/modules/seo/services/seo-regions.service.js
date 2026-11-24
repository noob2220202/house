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
exports.SeoRegionsService = void 0;
exports.inRegion = inRegion;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const cache_service_1 = require("../../../common/cache/cache.service");
const app_exception_1 = require("../../../common/errors/app.exception");
const app_config_service_1 = require("../../../config/app-config.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const regions_service_1 = require("../../complexes/services/regions.service");
const listing_search_repository_1 = require("../../listings/listing-search.repository");
const constants_1 = require("../constants");
const seo_domain_1 = require("../seo.domain");
const ASSET_TYPES = (0, shared_1.enumValues)(shared_1.AssetType);
const DEAL_ORDER = [shared_1.DealType.PRESALE, shared_1.DealType.SALE, shared_1.DealType.JEONSE, shared_1.DealType.MONTHLY];
const COMPLEX_TYPES = [shared_1.AssetType.APT, shared_1.AssetType.OFFICETEL];
/** Public listings, as everywhere else: 광고중/계약중, not deleted, approved primary office. */
const PUBLIC_LISTING_SQL = client_1.Prisma.sql `l.deleted_at IS NULL AND ${listing_search_repository_1.PUBLIC_STATUS_SQL} AND ${listing_search_repository_1.PRIMARY_AGENCY_APPROVED_SQL}`;
const regionKeySql = (col) => client_1.Prisma.sql `(CASE WHEN length(${col}) = 10 AND right(${col}, 2) = '00' THEN left(${col}, 8) ELSE ${col} END)`;
const HAS_REGION = (col) => client_1.Prisma.sql `${col} ~ '^[0-9]{8}([0-9]{2})?$'`;
/** True when region key `key` lies in landing region `target` (an 읍·면 includes its 리). */
function inRegion(key, target) {
    if (!key)
        return false;
    return target.length === 8 ? key.startsWith(target) : key === target;
}
/** SQL prefix of the codes a landing region covers (8 digits → itself, its 00 variant and 리). */
const codePattern = (target) => (target.length === 8 ? `${target}%` : target);
const emptyAssetCounts = () => Object.fromEntries(ASSET_TYPES.map((t) => [t, 0]));
const iso = (d) => (d ? d.toISOString() : null);
const dateOnly = (d) => d.toISOString().slice(0, 10);
const later = (a, b) => a === null ? b : b === null ? a : a > b ? a : b;
/**
 * 지역 data for the search landing pages (/suncheon/<지역>/<매물종류>), sitemaps and llms.txt:
 * which 읍면동/리 have listings, 단지 or 아파트 실거래, and the facts a landing page states.
 * Reads listings / 단지 / trades read-only; every number is computed from stored rows.
 */
let SeoRegionsService = class SeoRegionsService {
    constructor(prisma, cache, config, regions) {
        this.prisma = prisma;
        this.cache = cache;
        this.config = config;
        this.regions = regions;
    }
    get sggCode() {
        return this.config.get('REGION_SGG_CODE');
    }
    async regionIndex() {
        return (0, seo_domain_1.buildRegionIndex)(await this.regions.activeSubRegions());
    }
    async regionName() {
        const row = await this.prisma.region.findUnique({
            where: { code: this.sggCode },
            select: { name: true },
        });
        return row?.name ?? shared_1.DEFAULT_REGION_NAME.split(' ').pop() ?? '';
    }
    index(now = new Date()) {
        const window = (0, seo_domain_1.tradeWindow)((0, shared_1.yearMonthOf)(now));
        return this.cache.getOrSet(`cache:seo:regions:${this.sggCode}:${window.toYm}`, constants_1.SEO_CACHE_TTL_SECONDS.REGIONS, () => this.computeIndex(window, now));
    }
    landing(code, assetTypes, now = new Date()) {
        const key = (0, seo_domain_1.regionKeyOf)(code) ?? code;
        const types = assetTypes?.length ? [...new Set(assetTypes)].sort() : [...ASSET_TYPES];
        const window = (0, seo_domain_1.tradeWindow)((0, shared_1.yearMonthOf)(now));
        return this.cache.getOrSet(`cache:seo:landing:${this.sggCode}:${key}:${types.join(',')}:${window.toYm}`, constants_1.SEO_CACHE_TTL_SECONDS.LANDING, () => this.computeLanding(key, types, window, now));
    }
    /** Per-region views (every region of the index, with 읍·면 totals including their 리). */
    async regionViews(window) {
        const sgg = this.sggCode;
        const [index, listingRows, complexRows, tradeRows] = await Promise.all([
            this.regionIndex(),
            this.prisma.$queryRaw `
        SELECT ${regionKeySql(client_1.Prisma.sql `l.emd_code`)} AS "regionKey", l.asset_type::text AS "assetType",
          count(*)::int AS "count", max(l.updated_at) AS "lastModified"
        FROM listings l
        WHERE ${PUBLIC_LISTING_SQL} AND l.sgg_code = ${sgg} AND ${HAS_REGION(client_1.Prisma.sql `l.emd_code`)}
        GROUP BY 1, 2`,
            this.prisma.$queryRaw `
        SELECT ${regionKeySql(client_1.Prisma.sql `c.emd_code`)} AS "regionKey", count(*)::int AS "count",
          max(c.updated_at) AS "lastModified"
        FROM complexes c
        WHERE c.deleted_at IS NULL AND c.sgg_code = ${sgg} AND ${HAS_REGION(client_1.Prisma.sql `c.emd_code`)}
          AND c.asset_type = ANY(${COMPLEX_TYPES}::asset_type[])
        GROUP BY 1`,
            this.prisma.$queryRaw `
        SELECT CASE WHEN c.id IS NULL THEN NULL ELSE ${regionKeySql(client_1.Prisma.sql `c.emd_code`)} END AS "complexRegionKey",
          t.emd_name AS "emdName", count(*)::int AS "count", max(t.updated_at) AS "lastModified"
        FROM trade_records t
        LEFT JOIN complexes c ON c.id = t.complex_id AND c.deleted_at IS NULL
        WHERE t.sgg_code = ${sgg} AND t.kind = 'APT_TRADE'::trade_sync_kind
          AND t.deal_type = 'SALE'::trade_deal_type AND t.cancelled = false
          AND t.deal_ym BETWEEN ${window.fromYm} AND ${window.toYm}
        GROUP BY 1, 2`,
        ]);
        const views = new Map();
        for (const r of index.values()) {
            views.set(r.code, {
                code: r.code,
                name: r.name,
                emdName: r.emdName,
                parentName: r.parentName,
                lat: r.lat,
                lng: r.lng,
                listingCounts: emptyAssetCounts(),
                complexCount: 0,
                saleTradeCount: 0,
                lastModified: null,
            });
        }
        // A 리 row counts for itself and for its 읍·면 (the 8-digit prefix).
        const targets = (key) => {
            if (!key)
                return [];
            const own = views.get(key);
            const parent = key.length === 10 ? views.get(key.slice(0, 8)) : undefined;
            return [own, parent].filter((v) => v !== undefined);
        };
        for (const row of listingRows) {
            for (const v of targets(row.regionKey)) {
                v.listingCounts[row.assetType] += row.count;
                v.lastModified = later(v.lastModified, iso(row.lastModified));
            }
        }
        for (const row of complexRows) {
            for (const v of targets(row.regionKey)) {
                v.complexCount += row.count;
                v.lastModified = later(v.lastModified, iso(row.lastModified));
            }
        }
        const resolve = (0, seo_domain_1.regionNameResolver)(index);
        for (const row of tradeRows) {
            for (const v of targets(row.complexRegionKey ?? resolve(row.emdName))) {
                v.saleTradeCount += row.count;
                v.lastModified = later(v.lastModified, iso(row.lastModified));
            }
        }
        return { index, views };
    }
    async computeIndex(window, now) {
        const [{ index, views }, regionName] = await Promise.all([
            this.regionViews(window),
            this.regionName(),
        ]);
        const regions = [...views.values()]
            .filter((v) => v.complexCount > 0 ||
            v.saleTradeCount > 0 ||
            Object.values(v.listingCounts).some((n) => n > 0))
            .sort((a, b) => (index.get(a.code)?.order ?? 0) - (index.get(b.code)?.order ?? 0));
        return {
            sggCode: this.sggCode,
            regionName,
            tradePeriod: window,
            regions,
            updatedAt: now.toISOString(),
        };
    }
    async computeLanding(key, types, window, now) {
        const sgg = this.sggCode;
        const { index, views } = await this.regionViews(window);
        const region = views.get(key);
        if (!region)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.REGION_NOT_FOUND);
        const pattern = codePattern(key);
        const complexTypes = types.filter((t) => COMPLEX_TYPES.includes(t));
        const wantsTrades = types.includes(shared_1.AssetType.APT);
        const [dealRows, complexRows, complexTotal, tradeRows] = await Promise.all([
            this.prisma.$queryRaw `
        SELECT l.deal_type::text AS "dealType", count(*)::int AS "count",
          min(l.price_sort) FILTER (WHERE l.price_sort > 0) AS "minPrice",
          max(l.price_sort) FILTER (WHERE l.price_sort > 0) AS "maxPrice",
          round(avg(l.price_sort) FILTER (WHERE l.price_sort > 0))::int AS "avgPrice",
          min(l.monthly_rent) FILTER (WHERE l.deal_type = 'MONTHLY'::deal_type) AS "minRent",
          max(l.monthly_rent) FILTER (WHERE l.deal_type = 'MONTHLY'::deal_type) AS "maxRent",
          max(l.published_at) AS "lastPublishedAt"
        FROM listings l
        WHERE ${PUBLIC_LISTING_SQL} AND l.sgg_code = ${sgg} AND l.emd_code LIKE ${pattern}
          AND l.asset_type = ANY(${types}::asset_type[])
        GROUP BY 1`,
            complexTypes.length
                ? this.prisma.$queryRaw `
            SELECT c.id, c.name, c.asset_type::text AS "assetType", c.households,
              c.built_year AS "builtYear", c.approval_date AS "approvalDate",
              (SELECT count(*)::int FROM listings l
                WHERE l.complex_id = c.id AND ${PUBLIC_LISTING_SQL}) AS "activeListingCount",
              s.price AS "salePrice", s.deal_date AS "saleDate",
              s.exclusive_area::float AS "saleArea", s.floor AS "saleFloor"
            FROM complexes c
            LEFT JOIN LATERAL (
              SELECT t.price, t.deal_date, t.exclusive_area, t.floor FROM trade_records t
              WHERE t.complex_id = c.id AND t.deal_type = 'SALE'::trade_deal_type
                AND t.cancelled = false AND t.price > 0
              ORDER BY t.deal_date DESC, t.id DESC LIMIT 1
            ) s ON true
            WHERE c.deleted_at IS NULL AND c.sgg_code = ${sgg} AND c.emd_code LIKE ${pattern}
              AND c.asset_type = ANY(${complexTypes}::asset_type[])
            ORDER BY "activeListingCount" DESC, c.households DESC NULLS LAST, c.name ASC
            LIMIT ${constants_1.LANDING_COMPLEX_LIMIT}`
                : Promise.resolve([]),
            complexTypes.length
                ? this.prisma.complex.count({
                    where: {
                        deletedAt: null,
                        sggCode: sgg,
                        assetType: { in: complexTypes },
                        emdCode: key.length === 8 ? { startsWith: key } : key,
                    },
                })
                : Promise.resolve(0),
            wantsTrades
                ? this.prisma.$queryRaw `
            SELECT t.deal_type::text AS "dealType", t.deal_date AS "dealDate",
              c.id AS "complexId", c.name AS "complexName", t.apt_name AS "aptName",
              t.emd_name AS "emdName",
              CASE WHEN c.id IS NULL THEN NULL ELSE ${regionKeySql(client_1.Prisma.sql `c.emd_code`)} END AS "complexRegionKey",
              t.exclusive_area::float AS "exclusiveArea", t.floor, t.price, t.deposit
            FROM trade_records t
            LEFT JOIN complexes c ON c.id = t.complex_id AND c.deleted_at IS NULL
            WHERE t.sgg_code = ${sgg} AND t.cancelled = false
              AND t.deal_type IN ('SALE'::trade_deal_type, 'JEONSE'::trade_deal_type)
              AND t.deal_ym BETWEEN ${window.fromYm} AND ${window.toYm}
              AND (c.emd_code LIKE ${pattern} OR c.id IS NULL)`
                : Promise.resolve([]),
        ]);
        const byDealType = DEAL_ORDER.flatMap((dealType) => {
            const r = dealRows.find((row) => row.dealType === dealType);
            return r
                ? [
                    {
                        dealType,
                        count: r.count,
                        minPrice: r.minPrice,
                        maxPrice: r.maxPrice,
                        avgPrice: r.avgPrice,
                        minRent: r.minRent,
                        maxRent: r.maxRent,
                    },
                ]
                : [];
        });
        const lastPublishedAt = dealRows.reduce((acc, r) => later(acc, iso(r.lastPublishedAt)), null);
        const complexes = complexRows.map((c) => ({
            id: c.id,
            name: c.name,
            assetType: c.assetType,
            households: c.households,
            builtYear: c.builtYear,
            approvalDate: c.approvalDate ? dateOnly(c.approvalDate) : null,
            activeListingCount: c.activeListingCount,
            latestSale: c.salePrice !== null && c.saleDate !== null
                ? {
                    price: c.salePrice,
                    dealDate: dateOnly(c.saleDate),
                    exclusiveArea: c.saleArea ?? 0,
                    floor: c.saleFloor,
                }
                : null,
        }));
        let trades = null;
        if (wantsTrades) {
            const resolve = (0, seo_domain_1.regionNameResolver)(index);
            const own = tradeRows.filter((t) => inRegion(t.complexRegionKey ?? resolve(t.emdName), key));
            const sales = own.filter((t) => t.dealType === 'SALE' && t.price !== null && t.price > 0);
            const recent = [...sales]
                .sort((a, b) => b.dealDate.getTime() - a.dealDate.getTime())
                .slice(0, constants_1.LANDING_RECENT_TRADES)
                .map((t) => ({
                dealDate: dateOnly(t.dealDate),
                complexId: t.complexId,
                aptName: t.complexName ?? t.aptName,
                exclusiveArea: t.exclusiveArea,
                floor: t.floor,
                price: t.price,
            }));
            trades = {
                ...window,
                sale: (0, seo_domain_1.summarizeSales)(sales.map((t) => ({ price: t.price, exclusiveArea: t.exclusiveArea }))),
                jeonse: (0, seo_domain_1.summarizeDeposits)(own.filter((t) => t.dealType === 'JEONSE').map((t) => t.deposit ?? 0)),
                recent,
            };
        }
        return {
            region,
            assetTypes: types,
            listings: {
                total: byDealType.reduce((n, d) => n + d.count, 0),
                byDealType,
                lastPublishedAt,
            },
            complexes,
            complexTotal,
            trades,
            updatedAt: now.toISOString(),
        };
    }
};
exports.SeoRegionsService = SeoRegionsService;
exports.SeoRegionsService = SeoRegionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        app_config_service_1.AppConfig,
        regions_service_1.RegionsService])
], SeoRegionsService);
//# sourceMappingURL=seo-regions.service.js.map