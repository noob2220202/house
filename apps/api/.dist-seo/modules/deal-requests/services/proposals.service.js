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
exports.ProposalsService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const daily_cap_service_1 = require("../../../common/throttle/daily-cap.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const agencies_service_1 = require("../../agencies/services/agencies.service");
const deal_request_mapper_1 = require("../deal-request.mapper");
const deal_request_selects_1 = require("../deal-request.selects");
const notifications_service_1 = require("../notifications/notifications.service");
const agency_directory_port_1 = require("../ports/agency-directory.port");
const listings_port_1 = require("../ports/listings.port");
const agency_actor_service_1 = require("./agency-actor.service");
const deal_request_access_1 = require("./deal-request-access");
const deal_request_lifecycle_service_1 = require("./deal-request-lifecycle.service");
/** Proposals: agencies send/withdraw them; the requester accepts (optionally sharing contact) or declines. */
let ProposalsService = class ProposalsService {
    constructor(prisma, dailyCaps, mapper, notifications, lifecycle, actors, agencyService, agencies, listings) {
        this.prisma = prisma;
        this.dailyCaps = dailyCaps;
        this.mapper = mapper;
        this.notifications = notifications;
        this.lifecycle = lifecycle;
        this.actors = actors;
        this.agencyService = agencyService;
        this.agencies = agencies;
        this.listings = listings;
    }
    // ---------------------------------- agency side ----------------------------------
    async create(user, dealRequestId, input, now = new Date()) {
        const actor = await this.actors.resolve(user);
        const req = await this.prisma.dealRequest.findFirst({
            where: { AND: [(0, deal_request_access_1.agencyVisibleWhere)(actor, now), { id: dealRequestId }] },
            select: { id: true, status: true, userId: true, dealTypes: true, expiresAt: true },
        });
        if (!req)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.DEAL_REQUEST_NOT_FOUND);
        if (req.status !== shared_1.DealRequestStatus.OPEN || (req.expiresAt && req.expiresAt <= now)) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.DEAL_REQUEST_CLOSED);
        }
        if (req.userId === user.userId)
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.PROPOSAL_OWN_REQUEST);
        const termIssues = (0, shared_1.proposalTermsIssues)(req.dealTypes, input);
        if (termIssues.length > 0) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.PROPOSAL_TERMS_INVALID, termIssues);
        }
        const proposable = await this.listings.proposableIds(actor.agencyId, input.listingIds);
        const invalid = input.listingIds.filter((id) => !proposable.has(id));
        if (invalid.length > 0) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.PROPOSAL_LISTING_INVALID, { listingIds: invalid });
        }
        const existing = await this.prisma.proposal.findUnique({
            where: { dealRequestId_agencyId: { dealRequestId, agencyId: actor.agencyId } },
            select: { id: true },
        });
        if (existing)
            throw app_exception_1.AppException.conflict(shared_1.ErrorCode.PROPOSAL_DUPLICATE);
        await this.dailyCaps.consume('PROPOSAL_CREATE', actor.agencyId, now);
        const agencyName = (await this.agencies.names([actor.agencyId])).get(actor.agencyId) ?? '';
        let result;
        try {
            result = await this.prisma.$transaction(async (tx) => {
                const proposal = await tx.proposal.create({
                    data: {
                        dealRequestId,
                        agencyId: actor.agencyId,
                        memberId: actor.memberId,
                        message: input.message,
                        suggestedPrice: input.suggestedPrice ?? null,
                        suggestedDeposit: input.suggestedDeposit ?? null,
                        suggestedMonthlyRent: input.suggestedMonthlyRent ?? null,
                    },
                    select: { id: true },
                });
                if (input.listingIds.length > 0) {
                    await tx.proposalListing.createMany({
                        data: input.listingIds.map((listingId) => ({ proposalId: proposal.id, listingId })),
                    });
                }
                await tx.dealRequest.update({
                    where: { id: dealRequestId },
                    data: { proposalCount: { increment: 1 } },
                });
                const sent = await this.notifications.createFor([req.userId], {
                    type: shared_1.NotificationType.PROPOSAL_RECEIVED,
                    title: '중개사무소의 제안이 도착했습니다.',
                    body: agencyName ? `${agencyName}에서 제안을 보냈습니다.` : null,
                    data: { dealRequestId, proposalId: proposal.id },
                }, tx);
                return { id: proposal.id, sent };
            });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw app_exception_1.AppException.conflict(shared_1.ErrorCode.PROPOSAL_DUPLICATE);
            }
            throw err;
        }
        await this.notifications.dispatch(result.sent);
        return this.loadForAgency(actor.agencyId, result.id);
    }
    async withdraw(user, id) {
        const actor = await this.actors.resolve(user);
        const p = await this.prisma.proposal.findFirst({
            where: { id, agencyId: actor.agencyId },
            select: { id: true, dealRequestId: true },
        });
        if (!p)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.PROPOSAL_NOT_FOUND);
        await this.prisma.$transaction(async (tx) => {
            const { count } = await tx.proposal.updateMany({
                where: { id, status: { in: [...shared_1.PROPOSAL_PENDING_STATUSES] } },
                data: { status: shared_1.ProposalStatus.WITHDRAWN },
            });
            if (count === 0)
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.PROPOSAL_STATE_INVALID);
            await tx.dealRequest.updateMany({
                where: { id: p.dealRequestId, proposalCount: { gt: 0 } },
                data: { proposalCount: { decrement: 1 } },
            });
        });
        return this.loadForAgency(actor.agencyId, id);
    }
    async listForAgency(user, q) {
        const actor = await this.actors.resolve(user);
        const where = {
            agencyId: actor.agencyId,
            dealRequest: { deletedAt: null },
            ...(q.status?.length ? { status: { in: q.status } } : {}),
        };
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.proposal.findMany({
            where,
            select: deal_request_selects_1.proposalAgencySelect,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...args,
        }), () => this.prisma.proposal.count({ where }));
        return { ...page, items: page.items.map((p) => this.mapper.proposalForAgency(p)) };
    }
    // -------------------------------- requester side ---------------------------------
    /**
     * Accept a proposal: the request becomes MATCHED and — when `shareContact` (the explicit consent
     * the UI asks for) — the agency gets a contact grant. Other proposals stay as they are.
     */
    async accept(user, id, input, now = new Date()) {
        const p = await this.findForRequester(user.userId, id);
        if (input.shareContact) {
            const approved = await this.agencies.approvedIds([p.agencyId]);
            if (!approved.has(p.agencyId)) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.DEAL_REQUEST_GRANT_INVALID);
            }
        }
        const sent = await this.prisma.$transaction(async (tx) => {
            const live = await tx.dealRequest.updateMany({
                where: {
                    id: p.dealRequestId,
                    deletedAt: null,
                    status: { in: [...shared_1.DEAL_REQUEST_ACTIVE_STATUSES] },
                },
                data: { status: shared_1.DealRequestStatus.MATCHED },
            });
            if (live.count === 0)
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.DEAL_REQUEST_STATE_INVALID);
            const { count } = await tx.proposal.updateMany({
                where: { id, status: { in: [...shared_1.PROPOSAL_PENDING_STATUSES] } },
                data: { status: shared_1.ProposalStatus.ACCEPTED, respondedAt: now },
            });
            if (count === 0)
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.PROPOSAL_STATE_INVALID);
            if (input.shareContact)
                await this.lifecycle.grant(tx, p.dealRequestId, p.agencyId, now);
            const recipients = (await this.agencies.memberRecipients([p.agencyId], tx)).filter((r) => r.userId !== user.userId);
            return this.notifications.createForMembers(recipients, {
                type: shared_1.NotificationType.PROPOSAL_ACCEPTED,
                title: '제안이 수락되었습니다.',
                body: input.shareContact ? '요청자가 연락처를 공개했습니다.' : null,
                data: {
                    dealRequestId: p.dealRequestId,
                    proposalId: id,
                    contactShared: input.shareContact,
                },
            }, tx);
        });
        await this.notifications.dispatch(sent);
        return this.loadForRequester(user.userId, id);
    }
    async decline(user, id, now = new Date()) {
        const p = await this.findForRequester(user.userId, id);
        const sent = await this.prisma.$transaction(async (tx) => {
            const { count } = await tx.proposal.updateMany({
                where: { id, status: { in: [...shared_1.PROPOSAL_PENDING_STATUSES] } },
                data: { status: shared_1.ProposalStatus.DECLINED, respondedAt: now },
            });
            if (count === 0)
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.PROPOSAL_STATE_INVALID);
            const recipients = (await this.agencies.memberRecipients([p.agencyId], tx)).filter((r) => r.userId !== user.userId);
            return this.notifications.createForMembers(recipients, {
                type: shared_1.NotificationType.SYSTEM,
                title: '보내신 제안이 거절되었습니다.',
                data: { dealRequestId: p.dealRequestId, proposalId: id },
            }, tx);
        });
        await this.notifications.dispatch(sent);
        return this.loadForRequester(user.userId, id);
    }
    // ---------------------------------------------------------------------------------
    /** Proposals on the user's own requests; withdrawn ones are invisible to the requester. */
    async findForRequester(userId, id) {
        const p = await this.prisma.proposal.findFirst({
            where: {
                id,
                status: { not: shared_1.ProposalStatus.WITHDRAWN },
                dealRequest: { userId, deletedAt: null },
            },
            select: { id: true, agencyId: true, dealRequestId: true },
        });
        if (!p)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.PROPOSAL_NOT_FOUND);
        return p;
    }
    async loadForRequester(userId, id) {
        const p = await this.prisma.proposal.findFirst({
            where: { id, dealRequest: { userId, deletedAt: null } },
            select: {
                ...deal_request_selects_1.proposalOwnerSelect,
                dealRequest: {
                    select: {
                        contactGrants: { where: { revokedAt: null }, select: { agencyId: true } },
                    },
                },
            },
        });
        if (!p)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.PROPOSAL_NOT_FOUND);
        const disclosure = await this.agencyService.getDisclosure(p.agencyId);
        const shared = p.dealRequest.contactGrants.some((g) => g.agencyId === p.agencyId);
        return this.mapper.proposalForOwner(p, disclosure, shared);
    }
    async loadForAgency(agencyId, id) {
        const p = await this.prisma.proposal.findFirst({
            where: { id, agencyId },
            select: deal_request_selects_1.proposalAgencySelect,
        });
        if (!p)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.PROPOSAL_NOT_FOUND);
        return this.mapper.proposalForAgency(p);
    }
};
exports.ProposalsService = ProposalsService;
exports.ProposalsService = ProposalsService = __decorate([
    (0, common_1.Injectable)(),
    __param(7, (0, common_1.Inject)(agency_directory_port_1.DEAL_REQUEST_AGENCIES)),
    __param(8, (0, common_1.Inject)(listings_port_1.DEAL_REQUEST_LISTINGS)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        daily_cap_service_1.DailyCapService,
        deal_request_mapper_1.DealRequestMapper,
        notifications_service_1.NotificationsService,
        deal_request_lifecycle_service_1.DealRequestLifecycleService,
        agency_actor_service_1.AgencyActorService,
        agencies_service_1.AgenciesService, Object, Object])
], ProposalsService);
//# sourceMappingURL=proposals.service.js.map