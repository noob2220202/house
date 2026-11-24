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
exports.ComplexNearbyService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const app_exception_1 = require("../../../common/errors/app.exception");
const geo_1 = require("../../../common/geo/geo");
const prisma_service_1 = require("../../../prisma/prisma.service");
const listing_selects_1 = require("../../listings/listing.selects");
const complex_mapper_1 = require("../complex.mapper");
const complex_media_port_1 = require("../ports/complex-media.port");
const complex_listings_service_1 = require("./complex-listings.service");
const PUBLIC_STATUS_SQL = client_1.Prisma.sql `l.status IN (${client_1.Prisma.join(shared_1.PUBLIC_LISTING_STATUSES.map((s) => client_1.Prisma.sql `${s}::listing_status`))})`;
const APPROVED_PRIMARY_SQL = client_1.Prisma.sql `l.primary_agency_id NOT IN (
  SELECT pa.id FROM agencies pa
  WHERE pa.status <> ${shared_1.AgencyStatus.APPROVED}::agency_status OR pa.deleted_at IS NOT NULL)`;
/** 주변 단지 and the offices advertising in a 단지 (단지 page side panels). */
let ComplexNearbyService = class ComplexNearbyService {
    constructor(prisma, listings, media) {
        this.prisma = prisma;
        this.listings = listings;
        this.media = media;
    }
    /** Live 단지 within `radiusM` of this one, nearest first. */
    async nearby(id, limit, radiusM) {
        const origin = await this.prisma.complex.findFirst({
            where: { id, deletedAt: null },
            select: { lat: true, lng: true },
        });
        if (!origin)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.COMPLEX_NOT_FOUND);
        const point = (0, geo_1.geoPoint)(origin.lat, origin.lng);
        const hits = await this.prisma.$queryRaw `
      SELECT c.id, ST_Distance(c.location, ${point})::float AS "distanceM"
      FROM complexes c
      WHERE c.deleted_at IS NULL AND c.id <> ${id}::uuid AND c.location IS NOT NULL
        AND ST_DWithin(c.location, ${point}, ${radiusM})
      ORDER BY "distanceM" ASC, c.id ASC
      LIMIT ${limit}`;
        if (hits.length === 0)
            return [];
        const ids = hits.map((h) => h.id);
        const [rows, counts] = await Promise.all([
            this.prisma.complex.findMany({
                where: { id: { in: ids } },
                select: {
                    id: true,
                    name: true,
                    assetType: true,
                    emdName: true,
                    lat: true,
                    lng: true,
                    households: true,
                    builtYear: true,
                    areaTypes: {
                        orderBy: [{ households: { sort: 'desc', nulls: 'last' } }, { exclusiveArea: 'asc' }],
                        take: 1,
                        select: { id: true, exclusiveArea: true, supplyArea: true, pyeongLabel: true },
                    },
                },
            }),
            this.listings.countsFor(ids),
        ]);
        const mainAreaIds = rows.flatMap((r) => (r.areaTypes[0] ? [r.areaTypes[0].id] : []));
        const [listingPrices, tradePrices] = await Promise.all([
            this.minListingPrices(ids),
            this.latestSalePrices(mainAreaIds),
        ]);
        const byId = new Map(rows.map((r) => [r.id, r]));
        return hits.flatMap((h) => {
            const r = byId.get(h.id);
            if (!r)
                return [];
            const c = counts.get(r.id);
            const byType = c?.byDealType ?? { SALE: 0, JEONSE: 0, MONTHLY: 0, PRESALE: 0 };
            const main = r.areaTypes[0];
            const dealType = byType.PRESALE > byType.SALE ? shared_1.DealType.PRESALE : shared_1.DealType.SALE;
            const price = main
                ? (listingPrices.get(`${r.id}|${dealType}|${main.id}`) ??
                    (dealType === shared_1.DealType.SALE ? tradePrices.get(main.id) : undefined) ??
                    null)
                : null;
            return [
                {
                    id: r.id,
                    name: r.name,
                    assetType: r.assetType,
                    emdName: r.emdName,
                    lat: r.lat,
                    lng: r.lng,
                    distanceM: Math.round(h.distanceM),
                    households: r.households,
                    builtYear: r.builtYear,
                    activeListingCount: c?.total ?? 0,
                    dealCounts: {
                        presale: byType.PRESALE,
                        sale: byType.SALE,
                        jeonse: byType.JEONSE,
                        monthly: byType.MONTHLY,
                    },
                    representative: main ? { pyeongLabel: (0, complex_mapper_1.areaTypeLabel)(main), price, dealType } : null,
                },
            ];
        });
    }
    /** Approved offices with public listings in the 단지, most listings first. */
    async agencies(id, limit) {
        const exists = await this.prisma.complex.count({ where: { id, deletedAt: null } });
        if (exists === 0)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.COMPLEX_NOT_FOUND);
        const groups = await this.prisma.listingAgency.groupBy({
            by: ['agencyId'],
            where: {
                status: shared_1.ListingAgencyStatus.ACTIVE,
                agency: { status: shared_1.AgencyStatus.APPROVED, deletedAt: null },
                listing: {
                    complexId: id,
                    deletedAt: null,
                    status: { in: [...shared_1.PUBLIC_LISTING_STATUSES] },
                    ...listing_selects_1.PUBLIC_PRIMARY_AGENCY_WHERE,
                },
            },
            _count: { _all: true },
        });
        if (groups.length === 0)
            return [];
        const agencies = await this.prisma.agency.findMany({
            where: { id: { in: groups.map((g) => g.agencyId) } },
            select: {
                id: true,
                name: true,
                representativeName: true,
                phone: true,
                logo: { select: { storageKey: true, variants: true, deletedAt: true } },
            },
        });
        const count = new Map(groups.map((g) => [g.agencyId, g._count._all]));
        return agencies
            .map((a) => ({
            agencyId: a.id,
            name: a.name,
            representativeName: a.representativeName,
            phone: a.phone,
            logoUrl: a.logo && !a.logo.deletedAt ? this.media.urls(a.logo).thumbUrl : null,
            specialtyLabel: null,
            complexListingCount: count.get(a.id) ?? 0,
            avgResponseMinutes: null,
        }))
            .sort((x, y) => y.complexListingCount - x.complexListingCount ||
            x.name.localeCompare(y.name, 'ko') ||
            x.agencyId.localeCompare(y.agencyId))
            .slice(0, limit);
    }
    /** Lowest public asking price per (단지, deal type, 평형) — key `complexId|dealType|areaTypeId`. */
    async minListingPrices(complexIds) {
        const rows = await this.prisma.$queryRaw `
      SELECT l.complex_id AS "complexId", l.deal_type::text AS "dealType",
        p.area_type_id AS "areaTypeId", min(l.price_sort)::int AS "price"
      FROM listings l JOIN properties p ON p.id = l.property_id
      WHERE l.complex_id = ANY(${complexIds}::uuid[]) AND l.deleted_at IS NULL
        AND ${PUBLIC_STATUS_SQL} AND ${APPROVED_PRIMARY_SQL}
        AND p.area_type_id IS NOT NULL AND l.price_sort IS NOT NULL
      GROUP BY 1, 2, 3`;
        return new Map(rows.map((r) => [`${r.complexId}|${r.dealType}|${r.areaTypeId}`, r.price]));
    }
    /** Latest (not cancelled) 매매 실거래가 per 평형. */
    async latestSalePrices(areaTypeIds) {
        if (areaTypeIds.length === 0)
            return new Map();
        const rows = await this.prisma.$queryRaw `
      SELECT DISTINCT ON (area_type_id) area_type_id AS "areaTypeId", price
      FROM trade_records
      WHERE area_type_id = ANY(${areaTypeIds}::uuid[]) AND deal_type = 'SALE'::trade_deal_type
        AND NOT cancelled AND price IS NOT NULL
      ORDER BY area_type_id, deal_date DESC, id DESC`;
        return new Map(rows.map((r) => [r.areaTypeId, r.price]));
    }
};
exports.ComplexNearbyService = ComplexNearbyService;
exports.ComplexNearbyService = ComplexNearbyService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(complex_media_port_1.COMPLEX_MEDIA)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        complex_listings_service_1.ComplexListingsService, Object])
], ComplexNearbyService);
//# sourceMappingURL=complex-nearby.service.js.map