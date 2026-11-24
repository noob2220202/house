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
exports.ListingCandidatesService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const decimal_1 = require("../../../common/utils/decimal");
const prisma_service_1 = require("../../../prisma/prisma.service");
const listing_match_1 = require("../domain/listing-match");
const media_port_1 = require("../ports/media.port");
const agency_actor_service_1 = require("./agency-actor.service");
const deal_request_access_1 = require("./deal-request-access");
const region_names_service_1 = require("./region-names.service");
/** Ranking happens in memory: an office has a few hundred active listings at most. */
const CANDIDATE_SCAN_LIMIT = 500;
const candidateSelect = {
    id: true,
    title: true,
    assetType: true,
    dealType: true,
    salePrice: true,
    deposit: true,
    monthlyRent: true,
    presalePrice: true,
    premium: true,
    exclusiveArea: true,
    rooms: true,
    emdCode: true,
    complexId: true,
    verifiedAt: true,
    complex: { select: { name: true } },
    property: { select: { floor: true, totalFloors: true } },
    photos: {
        where: { media: { deletedAt: null } },
        orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
        take: 1,
        select: { media: { select: { storageKey: true, variants: true } } },
    },
};
/**
 * GET /agency/deal-requests/:id/listing-candidates — the agency's ACTIVE listings that may be
 * attached to a proposal for a request it can see (the proposal rule: ACTIVE + actively
 * (co-)brokered), best match for the request first. Reads the listing tables read-only.
 */
let ListingCandidatesService = class ListingCandidatesService {
    constructor(prisma, actors, regionNames, media) {
        this.prisma = prisma;
        this.actors = actors;
        this.regionNames = regionNames;
        this.media = media;
    }
    async list(user, id, q, now = new Date()) {
        const actor = await this.actors.resolve(user);
        const request = await this.prisma.dealRequest.findFirst({
            where: { AND: [(0, deal_request_access_1.agencyVisibleWhere)(actor, now), { id }] },
            select: {
                type: true,
                assetType: true,
                dealTypes: true,
                emdCode: true,
                complexId: true,
                regionCodes: true,
                complexIds: true,
                priceMin: true,
                priceMax: true,
                depositMin: true,
                depositMax: true,
                rentMin: true,
                rentMax: true,
                areaMin: true,
                areaMax: true,
                roomsMin: true,
            },
        });
        if (!request)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.DEAL_REQUEST_NOT_FOUND);
        const match = {
            ...request,
            areaMin: (0, decimal_1.decimalToNumber)(request.areaMin),
            areaMax: (0, decimal_1.decimalToNumber)(request.areaMax),
        };
        const rows = await this.prisma.listing.findMany({
            where: {
                deletedAt: null,
                status: shared_1.ListingStatus.ACTIVE,
                agencies: { some: { agencyId: actor.agencyId, status: shared_1.ListingAgencyStatus.ACTIVE } },
                ...(q.q
                    ? {
                        OR: [
                            { title: { contains: q.q, mode: 'insensitive' } },
                            { complex: { name: { contains: q.q, mode: 'insensitive' } } },
                        ],
                    }
                    : {}),
            },
            orderBy: [{ verifiedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
            take: CANDIDATE_SCAN_LIMIT,
            select: candidateSelect,
        });
        const names = await this.regionNames.namesOf(rows.map((r) => r.emdCode));
        const ranked = (0, listing_match_1.rankByMatch)(match, rows.map((r) => this.toView(r, names)));
        const { skip, take } = (0, pagination_1.toSkipTake)(q);
        return (0, pagination_1.toPaginated)(ranked.slice(skip, skip + take), ranked.length, q);
    }
    toView(r, names) {
        const cover = r.photos[0]?.media;
        const monthly = r.dealType === shared_1.DealType.MONTHLY;
        const price = r.dealType === shared_1.DealType.SALE
            ? r.salePrice
            : r.dealType === shared_1.DealType.PRESALE
                ? r.presalePrice === null
                    ? null
                    : r.presalePrice + (r.premium ?? 0)
                : r.dealType === shared_1.DealType.JEONSE
                    ? r.deposit
                    : null;
        return {
            id: r.id,
            title: r.title ?? r.complex?.name ?? '제목 없는 매물',
            assetType: r.assetType,
            dealType: r.dealType,
            price,
            deposit: monthly ? r.deposit : null,
            monthlyRent: monthly ? r.monthlyRent : null,
            exclusiveArea: (0, decimal_1.decimalToNumber)(r.exclusiveArea),
            // The agency's own listing: the exact floor is fine here.
            floorLabel: (0, shared_1.floorLabel)(r.property.floor, r.property.totalFloors),
            rooms: r.rooms,
            emdCode: r.emdCode,
            emdName: r.emdCode ? (names.get(r.emdCode) ?? null) : null,
            complexId: r.complexId,
            thumbUrl: cover ? this.media.publicUrl(cover, 'thumb') : null,
            verifiedAt: r.verifiedAt?.toISOString() ?? null,
        };
    }
};
exports.ListingCandidatesService = ListingCandidatesService;
exports.ListingCandidatesService = ListingCandidatesService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(media_port_1.DEAL_REQUEST_MEDIA)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        agency_actor_service_1.AgencyActorService,
        region_names_service_1.RegionNamesService, Object])
], ListingCandidatesService);
//# sourceMappingURL=listing-candidates.service.js.map