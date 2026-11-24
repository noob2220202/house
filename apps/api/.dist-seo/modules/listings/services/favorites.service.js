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
exports.FavoritesService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const listing_selects_1 = require("../listing.selects");
const listing_summaries_service_1 = require("./listing-summaries.service");
/** Favorites stay listed after a deal closes (shown as 거래완료); drafts/hidden/deleted drop out. */
const FAVORITE_VISIBLE_STATUSES = [...shared_1.PUBLIC_LISTING_STATUSES, shared_1.ListingStatus.CLOSED];
let FavoritesService = class FavoritesService {
    constructor(prisma, summaries) {
        this.prisma = prisma;
        this.summaries = summaries;
    }
    /** Idempotent: favoriting twice keeps one row and counts once. */
    async add(userId, listingId) {
        const listing = await this.prisma.listing.findFirst({
            where: {
                id: listingId,
                deletedAt: null,
                status: { in: [...shared_1.PUBLIC_LISTING_STATUSES] },
                ...listing_selects_1.PUBLIC_PRIMARY_AGENCY_WHERE,
            },
            select: { id: true },
        });
        if (!listing)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.LISTING_NOT_FOUND);
        await this.prisma.$transaction(async (tx) => {
            const { count } = await tx.favoriteListing.createMany({
                data: [{ userId, listingId }],
                skipDuplicates: true,
            });
            if (count > 0) {
                await tx.listing.update({
                    where: { id: listingId },
                    data: { favoriteCount: { increment: 1 } },
                });
            }
        });
        return { listingId, favorited: true };
    }
    async remove(userId, listingId) {
        await this.prisma.$transaction(async (tx) => {
            const { count } = await tx.favoriteListing.deleteMany({ where: { userId, listingId } });
            if (count > 0) {
                await tx.$executeRaw `
          UPDATE listings SET favorite_count = GREATEST(favorite_count - 1, 0)
          WHERE id = ${listingId}::uuid`;
            }
        });
    }
    async list(userId, q) {
        const where = {
            userId,
            listing: {
                deletedAt: null,
                status: { in: FAVORITE_VISIBLE_STATUSES },
                ...listing_selects_1.PUBLIC_PRIMARY_AGENCY_WHERE,
            },
        };
        return (0, pagination_1.paginate)(q, async (args) => {
            const rows = await this.prisma.favoriteListing.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true, listing: { select: listing_selects_1.LISTING_SUMMARY_SELECT } },
                ...args,
            });
            const listings = await this.summaries.map(rows.map((r) => r.listing));
            return rows.map((r, i) => ({
                favoritedAt: r.createdAt.toISOString(),
                listing: listings[i],
            }));
        }, () => this.prisma.favoriteListing.count({ where }));
    }
    async isFavorite(userId, listingId) {
        const row = await this.prisma.favoriteListing.findUnique({
            where: { userId_listingId: { userId, listingId } },
            select: { userId: true },
        });
        return row !== null;
    }
};
exports.FavoritesService = FavoritesService;
exports.FavoritesService = FavoritesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        listing_summaries_service_1.ListingSummariesService])
], FavoritesService);
//# sourceMappingURL=favorites.service.js.map