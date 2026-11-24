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
exports.PrismaAgencyListingsReader = exports.AGENCY_LISTINGS_READER = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const decimal_1 = require("../../../common/utils/decimal");
const prisma_service_1 = require("../../../prisma/prisma.service");
const agency_media_port_1 = require("./agency-media.port");
exports.AGENCY_LISTINGS_READER = Symbol('AGENCY_LISTINGS_READER');
let PrismaAgencyListingsReader = class PrismaAgencyListingsReader {
    constructor(prisma, media) {
        this.prisma = prisma;
        this.media = media;
    }
    /**
     * Advertised (ACTIVE) listings the agency is an active (co-)broker of, by type. A listing whose
     * primary agency is suspended is not advertised, even through its co-brokers.
     */
    async counts(agencyId) {
        const rows = await this.prisma.$queryRaw `
      SELECT l.asset_type::text AS "assetType", l.deal_type::text AS "dealType", count(*)::int AS count
      FROM listing_agencies la
      JOIN listings l ON l.id = la.listing_id
      WHERE la.agency_id = ${agencyId}::uuid
        AND la.status = ${shared_1.ListingAgencyStatus.ACTIVE}::listing_agency_status
        AND l.status = ${shared_1.ListingStatus.ACTIVE}::listing_status
        AND l.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM agencies pa WHERE pa.id = l.primary_agency_id
          AND pa.status = ${shared_1.AgencyStatus.APPROVED}::agency_status AND pa.deleted_at IS NULL)
      GROUP BY l.asset_type, l.deal_type`;
        const out = { total: 0, byAssetType: {}, byDealType: {} };
        for (const r of rows) {
            out.total += r.count;
            out.byAssetType[r.assetType] = (out.byAssetType[r.assetType] ?? 0) + r.count;
            out.byDealType[r.dealType] = (out.byDealType[r.dealType] ?? 0) + r.count;
        }
        return out;
    }
    /** 대표 매물: most recently 실매물-verified, then newest. No 동/호 or address detail. */
    async representative(agencyId, limit) {
        const rows = await this.prisma.listing.findMany({
            where: {
                status: shared_1.ListingStatus.ACTIVE,
                deletedAt: null,
                agencies: { some: { agencyId, status: shared_1.ListingAgencyStatus.ACTIVE } },
                // Same visibility rule as public listing search: the primary agency must be approved.
                primaryAgency: { status: shared_1.AgencyStatus.APPROVED, deletedAt: null },
            },
            orderBy: [
                { verifiedAt: { sort: 'desc', nulls: 'last' } },
                { publishedAt: { sort: 'desc', nulls: 'last' } },
                { id: 'desc' },
            ],
            take: limit,
            select: {
                id: true,
                assetType: true,
                dealType: true,
                title: true,
                salePrice: true,
                deposit: true,
                monthlyRent: true,
                presalePrice: true,
                premium: true,
                exclusiveArea: true,
                rooms: true,
                verifiedAt: true,
                publishedAt: true,
                complex: { select: { name: true } },
                photos: {
                    where: { media: { deletedAt: null } },
                    orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
                    take: 1,
                    select: { media: { select: { storageKey: true, variants: true } } },
                },
            },
        });
        return rows.map((l) => {
            const cover = l.photos[0]?.media;
            return {
                id: l.id,
                assetType: l.assetType,
                dealType: l.dealType,
                title: l.title,
                complexName: l.complex?.name ?? null,
                salePrice: l.salePrice,
                deposit: l.deposit,
                monthlyRent: l.monthlyRent,
                presalePrice: l.presalePrice,
                premium: l.premium,
                exclusiveArea: (0, decimal_1.decimalToNumber)(l.exclusiveArea),
                rooms: l.rooms,
                thumbnailUrl: cover ? this.media.publicUrl(cover, 'thumb') : null,
                verifiedAt: l.verifiedAt?.toISOString() ?? null,
                publishedAt: l.publishedAt?.toISOString() ?? null,
            };
        });
    }
};
exports.PrismaAgencyListingsReader = PrismaAgencyListingsReader;
exports.PrismaAgencyListingsReader = PrismaAgencyListingsReader = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(agency_media_port_1.AGENCY_MEDIA)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object])
], PrismaAgencyListingsReader);
//# sourceMappingURL=agency-listings.reader.js.map