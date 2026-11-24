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
exports.CoBrokerageService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/errors/app.exception");
const prisma_service_1 = require("../../../prisma/prisma.service");
const listing_selects_1 = require("../listing.selects");
const agency_membership_port_1 = require("../ports/agency-membership.port");
const listing_notifier_port_1 = require("../ports/listing-notifier.port");
const agency_listings_service_1 = require("./agency-listings.service");
const listing_counters_service_1 = require("./listing-counters.service");
/**
 * 공동중개 needs both sides' consent: another agency *requests* to co-broker a publicly advertised
 * listing (PENDING, no rights, not public) and the primary agency accepts or rejects it. Co-brokers
 * may leave (WITHDRAWN, may request again); the primary may remove them (REMOVED: they cannot
 * request again, but the primary can still accept them back). The primary row never changes here.
 */
let CoBrokerageService = class CoBrokerageService {
    constructor(prisma, listings, counters, membership, notifier) {
        this.prisma = prisma;
        this.listings = listings;
        this.counters = counters;
        this.membership = membership;
        this.notifier = notifier;
    }
    async join(principal, listingId, dto) {
        const actor = await this.membership.resolveActor(principal);
        const listing = await this.prisma.listing.findFirst({
            where: { id: listingId, deletedAt: null },
            select: {
                id: true,
                status: true,
                primaryAgencyId: true,
                agencies: {
                    where: { agencyId: actor.agencyId },
                    select: { id: true, status: true },
                },
            },
        });
        const own = listing?.agencies[0];
        if (!listing || (!shared_1.PUBLIC_LISTING_STATUSES.includes(listing.status) && !own)) {
            // Drafts and hidden listings are invisible to outsiders.
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.LISTING_NOT_FOUND);
        }
        if (own?.status === shared_1.ListingAgencyStatus.ACTIVE) {
            throw app_exception_1.AppException.conflict(shared_1.ErrorCode.LISTING_CO_BROKER_DUPLICATE);
        }
        if (own?.status === shared_1.ListingAgencyStatus.PENDING) {
            throw app_exception_1.AppException.conflict(shared_1.ErrorCode.LISTING_CO_BROKER_PENDING);
        }
        if (own?.status === shared_1.ListingAgencyStatus.REMOVED) {
            throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.LISTING_CO_BROKER_REMOVED);
        }
        if (!shared_1.PUBLIC_LISTING_STATUSES.includes(listing.status)) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.LISTING_CO_BROKER_NOT_ALLOWED);
        }
        const contact = await this.listings.resolveContact(actor, dto);
        const requestedAt = new Date();
        await this.prisma.$transaction(async (tx) => {
            if (own) {
                // WITHDRAWN → PENDING; the status guard keeps a concurrent removal from being undone.
                const { count } = await tx.listingAgency.updateMany({
                    where: { id: own.id, status: shared_1.ListingAgencyStatus.WITHDRAWN },
                    data: {
                        ...contact,
                        status: shared_1.ListingAgencyStatus.PENDING,
                        joinedAt: requestedAt,
                        withdrawnAt: null,
                    },
                });
                if (count === 0)
                    throw app_exception_1.AppException.conflict(shared_1.ErrorCode.LISTING_CONCURRENT_MODIFICATION);
            }
            else {
                await tx.listingAgency.create({
                    data: {
                        listingId,
                        agencyId: actor.agencyId,
                        isPrimary: false,
                        status: shared_1.ListingAgencyStatus.PENDING,
                        joinedAt: requestedAt,
                        ...contact,
                    },
                });
            }
            await this.notifier.notifyAgencyOwners(tx, [listing.primaryAgencyId], {
                type: shared_1.NotificationType.CO_BROKER_REQUESTED,
                title: '공동중개 참여 요청이 도착했습니다.',
                body: '다른 중개사무소가 매물의 공동중개 참여를 요청했습니다. 수락 또는 거절해 주세요.',
                listingId,
            });
        });
        return {
            listingId,
            agencyId: actor.agencyId,
            status: shared_1.ListingAgencyStatus.PENDING,
            requestedAt: requestedAt.toISOString(),
        };
    }
    /** The primary accepts a request (PENDING) or takes back an agency it removed (REMOVED). */
    async accept(principal, listingId, agencyId) {
        const actor = await this.membership.resolveActor(principal);
        const listing = await this.listings.loadForActor(listingId, actor, { primaryOnly: true });
        if (!shared_1.PUBLIC_LISTING_STATUSES.includes(listing.status)) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.LISTING_CO_BROKER_NOT_ALLOWED);
        }
        const row = await this.prisma.listingAgency.findFirst({
            where: {
                listingId,
                agencyId,
                isPrimary: false,
                status: { in: [shared_1.ListingAgencyStatus.PENDING, shared_1.ListingAgencyStatus.REMOVED] },
                agency: listing_selects_1.DISCLOSABLE_AGENCY_WHERE,
            },
            select: { id: true, status: true },
        });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.LISTING_CO_BROKER_NOT_FOUND);
        await this.prisma.$transaction(async (tx) => {
            const { count } = await tx.listingAgency.updateMany({
                where: { id: row.id, status: row.status },
                data: { status: shared_1.ListingAgencyStatus.ACTIVE, joinedAt: new Date(), withdrawnAt: null },
            });
            if (count === 0)
                throw app_exception_1.AppException.conflict(shared_1.ErrorCode.LISTING_CONCURRENT_MODIFICATION);
            await this.counters.refresh(tx, { agencyIds: [agencyId] });
        });
        await this.counters.invalidateSearch();
        return this.listings.detail(listingId, actor);
    }
    /** The primary rejects a pending request; the requester cannot ask again on its own. */
    async reject(principal, listingId, agencyId) {
        const actor = await this.membership.resolveActor(principal);
        await this.listings.loadForActor(listingId, actor, { primaryOnly: true });
        await this.end(listingId, agencyId, [shared_1.ListingAgencyStatus.PENDING], shared_1.ListingAgencyStatus.REMOVED);
    }
    /** The acting agency leaves a listing it co-brokers, or cancels its pending request. */
    async leave(principal, listingId) {
        const actor = await this.membership.resolveActor(principal);
        await this.end(listingId, actor.agencyId, [shared_1.ListingAgencyStatus.ACTIVE, shared_1.ListingAgencyStatus.PENDING], shared_1.ListingAgencyStatus.WITHDRAWN);
    }
    /** The primary agency removes a co-broker (or drops a pending request). */
    async removeAgency(principal, listingId, agencyId) {
        const actor = await this.membership.resolveActor(principal);
        await this.listings.loadForActor(listingId, actor, { primaryOnly: true });
        await this.end(listingId, agencyId, [shared_1.ListingAgencyStatus.ACTIVE, shared_1.ListingAgencyStatus.PENDING], shared_1.ListingAgencyStatus.REMOVED);
    }
    async end(listingId, agencyId, from, to) {
        const row = await this.prisma.listingAgency.findFirst({
            where: { listingId, agencyId, status: { in: from }, listing: { deletedAt: null } },
            select: { id: true, isPrimary: true, status: true },
        });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.LISTING_CO_BROKER_NOT_FOUND);
        if (row.isPrimary)
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.LISTING_PRIMARY_CANNOT_LEAVE);
        await this.prisma.$transaction(async (tx) => {
            const { count } = await tx.listingAgency.updateMany({
                where: { id: row.id, status: row.status },
                data: { status: to, withdrawnAt: new Date() },
            });
            if (count === 0)
                throw app_exception_1.AppException.conflict(shared_1.ErrorCode.LISTING_CONCURRENT_MODIFICATION);
            await this.counters.refresh(tx, { agencyIds: [agencyId] });
        });
        if (row.status === shared_1.ListingAgencyStatus.ACTIVE)
            await this.counters.invalidateSearch();
    }
};
exports.CoBrokerageService = CoBrokerageService;
exports.CoBrokerageService = CoBrokerageService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(agency_membership_port_1.LISTING_AGENCY_MEMBERSHIP)),
    __param(4, (0, common_1.Inject)(listing_notifier_port_1.LISTING_NOTIFIER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        agency_listings_service_1.AgencyListingsService,
        listing_counters_service_1.ListingCountersService, Object, Object])
], CoBrokerageService);
//# sourceMappingURL=co-brokerage.service.js.map