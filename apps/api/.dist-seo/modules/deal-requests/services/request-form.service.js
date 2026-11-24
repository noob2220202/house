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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestFormService = void 0;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const cache_service_1 = require("../../../common/cache/cache.service");
const pagination_1 = require("../../../common/pagination/pagination");
const decimal_1 = require("../../../common/utils/decimal");
const app_config_service_1 = require("../../../config/app-config.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../../agencies/constants");
const road_address_1 = require("../domain/road-address");
const media_port_1 = require("../ports/media.port");
const region_names_service_1 = require("./region-names.service");
/** Short-lived: counts follow approvals within a minute, and the agencies' version bump. */
const TARGETS_CACHE_TTL_SECONDS = 60;
/** Complexes and trades change at most daily (sync job). */
const ADDRESS_MATCH_CACHE_TTL_SECONDS = 300;
const AREA_LABEL_MAX = 3;
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const hash = (v) => (0, node_crypto_1.createHash)('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 16);
/**
 * Lookups of the 내놓기 / 구하기 form (public): which offices a request reaches
 * (`ALL_AGENCIES_IN_REGION` = every APPROVED office of the service 시군구, the same rule as the
 * inbox) and which registered complex a postcode result is. Read-only; cached in Redis.
 */
let RequestFormService = class RequestFormService {
    constructor(prisma, config, cache, regionNames, media) {
        this.prisma = prisma;
        this.config = config;
        this.cache = cache;
        this.regionNames = regionNames;
        this.media = media;
    }
    async targetAgencies(q) {
        const codes = [...new Set([...(q.regionCodes ?? []), ...(q.emdCode ? [q.emdCode] : [])])];
        const v = await this.cache.version(constants_1.AGENCY_CACHE.PUBLIC);
        const key = `cache:deal-requests:targets:v${v}:${hash([q.q ?? '', [...codes].sort(), q.page, q.pageSize])}`;
        return this.cache.getOrSet(key, TARGETS_CACHE_TTL_SECONDS, () => this.loadTargets(q, codes));
    }
    async loadTargets(q, codes) {
        const sggCode = this.config.get('REGION_SGG_CODE');
        const parts = [
            client_1.Prisma.sql `a.deleted_at IS NULL`,
            client_1.Prisma.sql `a.status = ${shared_1.AgencyStatus.APPROVED}::agency_status`,
            client_1.Prisma.sql `a.sgg_code = ${sggCode}`,
        ];
        if (q.q) {
            const like = `%${escapeLike(q.q)}%`;
            parts.push(client_1.Prisma.sql `(a.name ILIKE ${like} OR a.representative_name ILIKE ${like} OR a.road_address ILIKE ${like})`);
        }
        const where = client_1.Prisma.join(parts, ' AND ');
        // Offices based in the requested 읍면동 first, then the busiest.
        const prefixes = codes.map((c) => c.slice(0, shared_1.REGION_CODE_LENGTH.EMD));
        // (A bare integer in ORDER BY would be a column position, so no constant fallback.)
        const local = prefixes.length > 0
            ? client_1.Prisma.sql `CASE WHEN LEFT(a.emd_code, ${shared_1.REGION_CODE_LENGTH.EMD}::int) = ANY(${prefixes}::text[]) THEN 0 ELSE 1 END, `
            : client_1.Prisma.empty;
        const { skip, take } = (0, pagination_1.toSkipTake)(q);
        const [rows, [count], names] = await Promise.all([
            this.prisma.$queryRaw `
        SELECT a.id::text AS id, a.name, a.representative_name AS "representativeName", a.phone,
               a.road_address AS "roadAddress", a.specialties::text[] AS specialties,
               a.active_listing_count AS "activeListingCount",
               m.storage_key AS "logoStorageKey", m.variants AS "logoVariants"
        FROM agencies a
        LEFT JOIN media m ON m.id = a.logo_media_id AND m.deleted_at IS NULL
        WHERE ${where}
        ORDER BY ${local}a.active_listing_count DESC, a.name ASC, a.id ASC
        LIMIT ${take} OFFSET ${skip}`,
            this.prisma.$queryRaw `
        SELECT count(*)::int AS count FROM agencies a WHERE ${where}`,
            this.regionNames.namesOf(codes),
        ]);
        const labels = [...new Set(codes.map((c) => names.get(c)).filter((n) => !!n))];
        return {
            ...(0, pagination_1.toPaginated)(rows.map((r) => this.toTarget(r)), count?.count ?? 0, q),
            areaLabel: labels.length > 0 ? labels.slice(0, AREA_LABEL_MAX).join('·') : null,
        };
    }
    toTarget(r) {
        return {
            id: r.id,
            name: r.name,
            representativeName: r.representativeName,
            phone: r.phone,
            roadAddress: r.roadAddress,
            specialty: r.specialties.length > 0
                ? `${r.specialties.map((s) => shared_1.ASSET_TYPE_LABEL[s]).join('·')} 전문`
                : null,
            activeListingCount: r.activeListingCount,
            avgResponseMinutes: null,
            logoUrl: r.logoStorageKey
                ? this.media.publicUrl({ storageKey: r.logoStorageKey, variants: r.logoVariants }, 'thumb')
                : null,
        };
    }
    async addressMatch(q) {
        const key = `cache:deal-requests:address-match:${hash([q.roadAddress, q.buildingName ?? '', q.bcode ?? ''])}`;
        return this.cache.getOrSet(key, ADDRESS_MATCH_CACHE_TTL_SECONDS, () => this.loadMatch(q));
    }
    async loadMatch(q) {
        const complexId = await this.findComplexId(q);
        if (!complexId) {
            const emdCode = q.bcode ?? null;
            const names = await this.regionNames.namesOf([emdCode]);
            return {
                emdCode,
                emdName: emdCode ? (names.get(emdCode) ?? null) : null,
                lat: null,
                lng: null,
                complex: null,
            };
        }
        const c = await this.prisma.complex.findUniqueOrThrow({
            where: { id: complexId },
            select: {
                id: true,
                name: true,
                emdCode: true,
                lat: true,
                lng: true,
                households: true,
                builtYear: true,
                floorsMax: true,
                areaTypes: {
                    select: { id: true, pyeongLabel: true, exclusiveArea: true, supplyArea: true },
                    orderBy: [{ exclusiveArea: 'asc' }, { id: 'asc' }],
                },
            },
        });
        const emdCode = c.emdCode ?? q.bcode ?? null;
        const [names, market] = await Promise.all([
            this.regionNames.namesOf([emdCode]),
            this.market(c.id),
        ]);
        const emdName = emdCode ? (names.get(emdCode) ?? null) : null;
        return {
            emdCode,
            emdName,
            lat: c.lat,
            lng: c.lng,
            complex: {
                id: c.id,
                name: c.name,
                emdName,
                households: c.households,
                builtYear: c.builtYear,
                floorsMax: c.floorsMax,
                areaTypes: c.areaTypes.map((a) => ({
                    id: a.id,
                    pyeongLabel: a.pyeongLabel ??
                        pyeongLabelOf((0, decimal_1.decimalToNumber)(a.supplyArea), (0, decimal_1.decimalToNumber)(a.exclusiveArea)),
                    exclusiveArea: (0, decimal_1.decimalToNumber)(a.exclusiveArea) ?? 0,
                    supplyArea: (0, decimal_1.decimalToNumber)(a.supplyArea),
                })),
                market,
            },
        };
    }
    /**
     * The registered complex of a postcode result: same road name + building number, else the same
     * building name (spaces ignored) in the 읍면동 of `bcode` (or the service 시군구).
     */
    async findComplexId(q) {
        const sggCode = this.config.get('REGION_SGG_CODE');
        const key = (0, road_address_1.roadKey)(q.roadAddress);
        const road = (0, road_address_1.roadNameOf)(q.roadAddress);
        if (key && road) {
            const rows = await this.prisma.complex.findMany({
                where: { deletedAt: null, sggCode, roadAddress: { contains: road } },
                select: { id: true, roadAddress: true },
                orderBy: { id: 'asc' },
                take: 50,
            });
            const hit = rows.find((r) => (0, road_address_1.roadKey)(r.roadAddress) === key);
            if (hit)
                return hit.id;
        }
        const wanted = (0, road_address_1.nameKey)(q.buildingName);
        if (wanted.length < 2)
            return null;
        const emd = q.bcode && q.bcode.length >= shared_1.REGION_CODE_LENGTH.EMD ? q.bcode.slice(0, 8) : null;
        const rows = await this.prisma.$queryRaw `
      SELECT c.id::text AS id FROM complexes c
      WHERE c.deleted_at IS NULL AND c.sgg_code = ${sggCode}
        ${emd ? client_1.Prisma.sql `AND c.emd_code LIKE ${`${emd}%`}` : client_1.Prisma.empty}
        AND lower(regexp_replace(c.name, '[\\s()·.,-]', '', 'g')) = ${wanted}
      ORDER BY c.households DESC NULLS LAST, c.id ASC
      LIMIT 1`;
        return rows[0]?.id ?? null;
    }
    /** Latest 매매 실거래 + asking range of the complex's advertised 매매 listings. */
    async market(complexId) {
        const [trade, asking] = await Promise.all([
            this.prisma.tradeRecord.findFirst({
                where: { complexId, dealType: shared_1.TradeDealType.SALE, cancelled: false, price: { not: null } },
                orderBy: [{ dealDate: 'desc' }, { id: 'desc' }],
                select: {
                    price: true,
                    dealYm: true,
                    exclusiveArea: true,
                    areaType: { select: { pyeongLabel: true, supplyArea: true } },
                },
            }),
            this.prisma.listing.aggregate({
                where: {
                    complexId,
                    deletedAt: null,
                    status: shared_1.ListingStatus.ACTIVE,
                    dealType: shared_1.DealType.SALE,
                    salePrice: { not: null },
                    primaryAgency: { status: shared_1.AgencyStatus.APPROVED, deletedAt: null },
                },
                _min: { salePrice: true },
                _max: { salePrice: true },
            }),
        ]);
        const askingMin = asking._min.salePrice ?? null;
        const askingMax = asking._max.salePrice ?? null;
        if (!trade && askingMin === null)
            return null;
        const supply = (0, decimal_1.decimalToNumber)(trade?.areaType?.supplyArea ?? null);
        const exclusive = (0, decimal_1.decimalToNumber)(trade?.exclusiveArea ?? null);
        const pyeong = supply ?? exclusive;
        const ym = trade ? String(trade.dealYm) : null;
        return {
            recentTradePrice: trade?.price ?? null,
            recentTradeYm: ym ? `${ym.slice(0, 4)}-${ym.slice(4, 6)}` : null,
            recentTradePyeong: trade
                ? (trade.areaType?.pyeongLabel ?? pyeongLabelOf(supply, exclusive))
                : null,
            askingMin,
            askingMax,
            perPyeong: trade?.price && pyeong ? Math.round(trade.price / (0, shared_1.sqmToPyeong)(pyeong, 4)) : null,
        };
    }
};
exports.RequestFormService = RequestFormService;
exports.RequestFormService = RequestFormService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(media_port_1.DEAL_REQUEST_MEDIA)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        app_config_service_1.AppConfig,
        cache_service_1.CacheService,
        region_names_service_1.RegionNamesService, Object])
], RequestFormService);
/** "34평" from 공급면적 (else 전용); null without an area. */
function pyeongLabelOf(supply, exclusive) {
    const area = supply ?? exclusive;
    return area ? `${Math.round((0, shared_1.sqmToPyeong)(area))}평` : null;
}
//# sourceMappingURL=request-form.service.js.map