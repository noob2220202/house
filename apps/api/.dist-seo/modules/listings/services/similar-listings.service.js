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
exports.SimilarListingsService = exports.SIMILAR_GROUP_SIZE = exports.SimilarGroupKey = void 0;
exports.formatManwon = formatManwon;
exports.priceBand = priceBand;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../../../common/cache/cache.service");
const app_exception_1 = require("../../../common/errors/app.exception");
const area_1 = require("../../../common/utils/area");
const decimal_1 = require("../../../common/utils/decimal");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../constants");
const region_key_1 = require("../domain/region-key");
const listing_selects_1 = require("../listing.selects");
const listing_region_names_service_1 = require("./listing-region-names.service");
const listing_summaries_service_1 = require("./listing-summaries.service");
exports.SimilarGroupKey = {
    SAME_COMPLEX: 'SAME_COMPLEX',
    SAME_AREA: 'SAME_AREA',
    SAME_PRICE: 'SAME_PRICE',
};
exports.SIMILAR_GROUP_SIZE = 8;
const SIMILAR_CACHE_TTL_SECONDS = 120;
/** 같은 평형: 전용면적 within ±16㎡ (≈ ±5평); 토지 compares 대지면적 within ±20 %. */
const AREA_TOLERANCE_SQM = 16;
const LAND_AREA_TOLERANCE = 0.2;
/** 같은 가격대: price (매매가 / 분양가+P / 보증금) within ±20 %, at least ±500만원. */
const PRICE_TOLERANCE = 0.2;
const PRICE_TOLERANCE_MIN_MANWON = 500;
const PUBLIC_WHERE = {
    deletedAt: null,
    status: { in: [...shared_1.PUBLIC_LISTING_STATUSES] },
    ...listing_selects_1.PUBLIC_PRIMARY_AGENCY_WHERE,
};
const ORDER = [
    { verifiedAt: { sort: 'desc', nulls: 'last' } },
    { publishedAt: { sort: 'desc', nulls: 'last' } },
    { id: 'desc' },
];
/** 만원 → "4.5억" / "9,500만". */
function formatManwon(v) {
    if (v >= 10_000) {
        const eok = Math.round(v / 1_000) / 10;
        return `${Number.isInteger(eok) ? eok : eok.toFixed(1)}억`;
    }
    return `${Math.round(v).toLocaleString('ko-KR')}만`;
}
/** [lo, hi] price band of 같은 가격대, or null without a price. */
function priceBand(price) {
    if (price === null || price <= 0)
        return null;
    const tol = Math.max(price * PRICE_TOLERANCE, PRICE_TOLERANCE_MIN_MANWON);
    return [Math.max(0, Math.floor(price - tol)), Math.ceil(price + tol)];
}
/** 비슷한 매물 of a public listing: 같은 단지 · 같은 지역 같은 평형 · 같은 가격대. */
let SimilarListingsService = class SimilarListingsService {
    constructor(prisma, summaries, regionNames, cache) {
        this.prisma = prisma;
        this.summaries = summaries;
        this.regionNames = regionNames;
        this.cache = cache;
    }
    async similar(id) {
        const base = await this.prisma.listing.findFirst({
            where: { id, ...PUBLIC_WHERE },
            select: {
                id: true,
                dealType: true,
                assetType: true,
                complexId: true,
                emdCode: true,
                priceSort: true,
                exclusiveArea: true,
                property: { select: { supplyArea: true, landArea: true } },
            },
        });
        if (!base)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.LISTING_NOT_FOUND);
        const version = await this.cache.version(constants_1.LISTINGS_SEARCH_CACHE_NS);
        return this.cache.getOrSet(`cache:listings:similar:v${version}:${id}`, SIMILAR_CACHE_TTL_SECONDS, () => this.compute(base));
    }
    async compute(base) {
        const regionKey = (0, region_key_1.regionKeyOf)(base.emdCode);
        const regionCodes = regionKey ? (0, region_key_1.emdCodesOfRegionKey)(regionKey) : null;
        const regionName = base.emdCode ? await this.regionNames.nameOf(base.emdCode) : null;
        const land = base.assetType === shared_1.AssetType.LAND;
        const kind = {
            ...PUBLIC_WHERE,
            id: { not: base.id },
            assetType: base.assetType,
        };
        const notSameComplex = base.complexId
            ? { OR: [{ complexId: null }, { complexId: { not: base.complexId } }] }
            : {};
        const areaSqm = land
            ? (0, decimal_1.decimalToNumber)(base.property.landArea)
            : (0, decimal_1.decimalToNumber)(base.exclusiveArea);
        const areaWhere = areaSqm === null || areaSqm <= 0
            ? null
            : land
                ? {
                    property: {
                        landArea: {
                            gte: areaSqm * (1 - LAND_AREA_TOLERANCE),
                            lte: areaSqm * (1 + LAND_AREA_TOLERANCE),
                        },
                    },
                }
                : {
                    exclusiveArea: {
                        gte: Math.max(0, areaSqm - AREA_TOLERANCE_SQM),
                        lte: areaSqm + AREA_TOLERANCE_SQM,
                    },
                };
        const band = priceBand(base.priceSort);
        const specs = [];
        if (base.complexId) {
            specs.push({
                key: exports.SimilarGroupKey.SAME_COMPLEX,
                label: '같은 단지',
                where: { ...kind, complexId: base.complexId },
            });
        }
        if (areaWhere) {
            specs.push({
                key: exports.SimilarGroupKey.SAME_AREA,
                label: `${regionName ? `${regionName} ` : ''}같은 ${land ? '면적' : '평형'}`,
                where: {
                    AND: [
                        kind,
                        { dealType: base.dealType },
                        areaWhere,
                        notSameComplex,
                        regionCodes ? { emdCode: { in: regionCodes } } : {},
                    ],
                },
            });
        }
        if (band) {
            specs.push({
                key: exports.SimilarGroupKey.SAME_PRICE,
                label: '같은 가격대',
                where: {
                    AND: [
                        kind,
                        { dealType: base.dealType },
                        { priceSort: { gte: band[0], lte: band[1] } },
                        notSameComplex,
                    ],
                },
            });
        }
        const [groups, regionListingCount] = await Promise.all([
            Promise.all(specs.map((s) => this.group(s.key, s.label, s.where))),
            regionCodes
                ? this.prisma.listing.count({ where: { ...PUBLIC_WHERE, emdCode: { in: regionCodes } } })
                : Promise.resolve(null),
        ]);
        const supply = (0, decimal_1.decimalToNumber)(base.property.supplyArea);
        const areaLabel = areaSqm === null || areaSqm <= 0
            ? null
            : land
                ? `${Math.round((0, shared_1.sqmToPyeong)(areaSqm))}평`
                : (0, area_1.pyeongLabel)(supply ?? areaSqm);
        const criteria = [
            regionName,
            shared_1.DEAL_TYPE_LABEL[base.dealType],
            areaLabel,
            band ? `${formatManwon(band[0])}~${formatManwon(band[1])}` : null,
        ]
            .filter(Boolean)
            .join(' · ');
        return {
            criteria: criteria || null,
            regionName,
            regionListingCount,
            groups: groups.filter((g) => g.items.length > 0),
        };
    }
    async group(key, label, where) {
        const [rows, total] = await Promise.all([
            this.prisma.listing.findMany({
                where,
                orderBy: ORDER,
                take: exports.SIMILAR_GROUP_SIZE,
                select: listing_selects_1.LISTING_SUMMARY_SELECT,
            }),
            this.prisma.listing.count({ where }),
        ]);
        return { key, label, total, items: await this.summaries.map(rows) };
    }
};
exports.SimilarListingsService = SimilarListingsService;
exports.SimilarListingsService = SimilarListingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        listing_summaries_service_1.ListingSummariesService,
        listing_region_names_service_1.ListingRegionNamesService,
        cache_service_1.CacheService])
], SimilarListingsService);
//# sourceMappingURL=similar-listings.service.js.map