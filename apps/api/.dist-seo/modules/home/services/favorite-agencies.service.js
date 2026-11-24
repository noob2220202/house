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
exports.FavoriteAgenciesService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const media_service_1 = require("../../media/media.service");
const listing_region_names_service_1 = require("../../listings/services/listing-region-names.service");
const DISCLOSABLE = { status: shared_1.AgencyStatus.APPROVED, deletedAt: null };
const AGENCY_CARD_SELECT = {
    id: true,
    name: true,
    representativeName: true,
    registrationNumber: true,
    phone: true,
    roadAddress: true,
    addressDetail: true,
    emdCode: true,
    lat: true,
    lng: true,
    specialties: true,
    activeListingCount: true,
    logo: { select: { storageKey: true, variants: true, deletedAt: true } },
};
/**
 * 관심 중개사무소 (same semantics as 관심 매물/단지: idempotent PUT/DELETE, scoped by the caller).
 * Only approved, live offices can be saved or listed; rows of offices that later stop being
 * disclosable are kept but hidden.
 */
let FavoriteAgenciesService = class FavoriteAgenciesService {
    constructor(prisma, media, regionNames) {
        this.prisma = prisma;
        this.media = media;
        this.regionNames = regionNames;
    }
    async add(userId, agencyId) {
        const exists = await this.prisma.agency.count({ where: { id: agencyId, ...DISCLOSABLE } });
        if (exists === 0)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AGENCY_NOT_FOUND);
        await this.prisma.favoriteAgency.createMany({
            data: [{ userId, agencyId }],
            skipDuplicates: true,
        });
    }
    async remove(userId, agencyId) {
        await this.prisma.favoriteAgency.deleteMany({ where: { userId, agencyId } });
    }
    async list(userId, q) {
        // Visible favourites = rows whose office is still disclosable (no relation: filter by id set).
        const rows = await this.prisma.favoriteAgency.findMany({
            where: { userId },
            orderBy: [{ createdAt: 'desc' }, { agencyId: 'asc' }],
            select: { agencyId: true, createdAt: true },
        });
        if (rows.length === 0)
            return (0, pagination_1.toPaginated)([], 0, q);
        const visible = new Set((await this.prisma.agency.findMany({
            where: { id: { in: rows.map((r) => r.agencyId) }, ...DISCLOSABLE },
            select: { id: true },
        })).map((a) => a.id));
        const favorites = rows.filter((r) => visible.has(r.agencyId));
        const { skip, take } = (0, pagination_1.toSkipTake)(q);
        const pageRows = favorites.slice(skip, skip + take);
        const agencies = await this.prisma.agency.findMany({
            where: { id: { in: pageRows.map((r) => r.agencyId) } },
            select: AGENCY_CARD_SELECT,
        });
        const names = await this.regionNames.namesOf(agencies.map((a) => a.emdCode));
        const byId = new Map(agencies.map((a) => [a.id, a]));
        const items = pageRows.flatMap((r) => {
            const a = byId.get(r.agencyId);
            if (!a)
                return [];
            return [
                {
                    id: a.id,
                    name: a.name,
                    representativeName: a.representativeName,
                    registrationNumber: a.registrationNumber,
                    phone: a.phone,
                    roadAddress: a.roadAddress,
                    addressDetail: a.addressDetail,
                    emdCode: a.emdCode,
                    emdName: (a.emdCode && names.get(a.emdCode)) ?? null,
                    lat: a.lat,
                    lng: a.lng,
                    specialties: a.specialties,
                    logoUrl: a.logo && !a.logo.deletedAt ? this.media.url(a.logo, 'thumb') : null,
                    activeListingCount: a.activeListingCount,
                    favoritedAt: r.createdAt.toISOString(),
                },
            ];
        });
        return (0, pagination_1.toPaginated)(items, favorites.length, q);
    }
};
exports.FavoriteAgenciesService = FavoriteAgenciesService;
exports.FavoriteAgenciesService = FavoriteAgenciesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        media_service_1.MediaService,
        listing_region_names_service_1.ListingRegionNamesService])
], FavoriteAgenciesService);
//# sourceMappingURL=favorite-agencies.service.js.map