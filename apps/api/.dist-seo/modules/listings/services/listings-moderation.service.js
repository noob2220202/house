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
exports.ListingsModerationService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/errors/app.exception");
const prisma_service_1 = require("../../../prisma/prisma.service");
const agency_listings_service_1 = require("./agency-listings.service");
const listing_counters_service_1 = require("./listing-counters.service");
/**
 * Admin-side moderation hooks (exported for the admin / reports modules, which own the routes
 * and the audit log). With `tx` the change joins the caller's transaction and the caller must call
 * ListingCountersService.invalidateSearch() after it commits.
 */
let ListingsModerationService = class ListingsModerationService {
    constructor(prisma, listings, counters) {
        this.prisma = prisma;
        this.listings = listings;
        this.counters = counters;
    }
    /** Hides a listing from the public site (e.g. 허위매물 신고 처리). Returns the previous status. */
    async hide(listingId, reason, tx) {
        const run = async (db) => {
            const current = await this.lockCurrent(db, listingId);
            await db.listing.update({
                where: { id: listingId },
                data: {
                    status: shared_1.ListingStatus.HIDDEN,
                    hiddenReason: reason.slice(0, 500),
                    version: { increment: 1 },
                },
            });
            if (shared_1.PUBLIC_LISTING_STATUSES.includes(current.status)) {
                await this.listings.refreshFor(db, listingId, current.complexId);
            }
            return current.status;
        };
        const previous = tx ? await run(tx) : await this.prisma.$transaction(run);
        if (!tx)
            await this.counters.invalidateSearch();
        return previous;
    }
    /** Operator force-close (거래완료 처리). Returns the previous status. */
    async close(listingId, reason, tx) {
        const run = async (db) => {
            const current = await this.lockCurrent(db, listingId);
            await db.listing.update({
                where: { id: listingId },
                data: {
                    status: shared_1.ListingStatus.CLOSED,
                    closedAt: new Date(),
                    hiddenReason: reason.slice(0, 500),
                    version: { increment: 1 },
                },
            });
            if (shared_1.PUBLIC_LISTING_STATUSES.includes(current.status)) {
                await this.listings.refreshFor(db, listingId, current.complexId);
            }
            return current.status;
        };
        const previous = tx ? await run(tx) : await this.prisma.$transaction(run);
        if (!tx)
            await this.counters.invalidateSearch();
        return previous;
    }
    /** Un-hides to DRAFT: the agency must publish again, which re-runs the 명시사항 check. */
    async unhide(listingId, tx) {
        const run = async (db) => {
            const { count } = await db.listing.updateMany({
                where: { id: listingId, deletedAt: null, status: shared_1.ListingStatus.HIDDEN },
                data: { status: shared_1.ListingStatus.DRAFT, hiddenReason: null, version: { increment: 1 } },
            });
            if (count === 0)
                throw app_exception_1.AppException.notFound(shared_1.ErrorCode.LISTING_NOT_FOUND);
        };
        if (tx)
            await run(tx);
        else
            await this.prisma.$transaction(run);
    }
    /**
     * Call when an agency stops being disclosable (suspended, rejected, soft-deleted) or becomes
     * approved again. Public queries already filter on the primary agency's status; this recomputes
     * the denormalized counters of everything the agency touches. Returns the affected listing count.
     */
    async onAgencyStatusChanged(agencyId, tx) {
        const run = async (db) => {
            const listings = await db.listing.findMany({
                where: {
                    deletedAt: null,
                    status: { in: [...shared_1.PUBLIC_LISTING_STATUSES] },
                    agencies: { some: { agencyId } },
                },
                select: { id: true, complexId: true, agencies: { select: { agencyId: true } } },
            });
            await this.counters.refresh(db, {
                complexIds: listings.map((l) => l.complexId),
                agencyIds: [agencyId, ...listings.flatMap((l) => l.agencies.map((a) => a.agencyId))],
            });
            return listings.length;
        };
        const n = tx ? await run(tx) : await this.prisma.$transaction(run);
        if (!tx)
            await this.counters.invalidateSearch();
        return n;
    }
    /**
     * A broker left / was removed from an agency: their name and phone must stop being advertised.
     * Their listing contacts move to the agency's 대표 (active OWNER member) or are cleared if there
     * is none. Call inside the caller's transaction; returns the number of listing links changed.
     */
    async memberDeparted(tx, agencyId, memberId) {
        const owner = await tx.agencyMember.findFirst({
            where: {
                agencyId,
                role: shared_1.AgencyMemberRole.OWNER,
                status: shared_1.AgencyMemberStatus.ACTIVE,
                id: { not: memberId },
            },
            select: { id: true, displayName: true, phone: true },
        });
        const { count } = await tx.listingAgency.updateMany({
            where: { agencyId, contactMemberId: memberId },
            data: owner
                ? { contactMemberId: owner.id, contactName: owner.displayName, contactPhone: owner.phone }
                : { contactMemberId: null, contactName: null, contactPhone: null },
        });
        return count;
    }
    /**
     * Reads the listing's status under a row lock. Under READ COMMITTED a FOR UPDATE that had to
     * wait returns the row as the other transaction committed it, so the status that decides
     * whether counters need a refresh is the one this transaction actually replaces.
     */
    async lockCurrent(db, listingId) {
        const [current] = await db.$queryRaw `
      SELECT status::text AS "status", complex_id AS "complexId"
      FROM listings WHERE id = ${listingId}::uuid AND deleted_at IS NULL
      FOR UPDATE`;
        if (!current)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.LISTING_NOT_FOUND);
        return current;
    }
    /** Map-tile / search cache invalidation; call after a transaction that passed `tx` commits. */
    invalidateSearch() {
        return this.counters.invalidateSearch();
    }
};
exports.ListingsModerationService = ListingsModerationService;
exports.ListingsModerationService = ListingsModerationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        agency_listings_service_1.AgencyListingsService,
        listing_counters_service_1.ListingCountersService])
], ListingsModerationService);
//# sourceMappingURL=listings-moderation.service.js.map