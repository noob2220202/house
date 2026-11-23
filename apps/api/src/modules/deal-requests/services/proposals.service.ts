import {
  DEAL_REQUEST_ACTIVE_STATUSES,
  DealRequestStatus,
  ErrorCode,
  NotificationType,
  PROPOSAL_PENDING_STATUSES,
  ProposalStatus,
  proposalTermsIssues,
  type AgencyProposalListQuery,
  type AgencyProposalView,
  type Paginated,
  type ProposalAcceptInput,
  type ProposalCreateInput,
  type ProposalView,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { DailyCapService } from '../../../common/throttle/daily-cap.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgenciesService } from '../../agencies/services/agencies.service';
import { DealRequestMapper } from '../deal-request.mapper';
import { proposalAgencySelect, proposalOwnerSelect } from '../deal-request.selects';
import { NotificationsService } from '../notifications/notifications.service';
import {
  DEAL_REQUEST_AGENCIES,
  type DealRequestAgencyDirectory,
} from '../ports/agency-directory.port';
import { DEAL_REQUEST_LISTINGS, type DealRequestListingsPort } from '../ports/listings.port';
import { AgencyActorService } from './agency-actor.service';
import { agencyVisibleWhere } from './deal-request-access';
import { DealRequestLifecycleService } from './deal-request-lifecycle.service';

/** Proposals: agencies send/withdraw them; the requester accepts (optionally sharing contact) or declines. */
@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyCaps: DailyCapService,
    private readonly mapper: DealRequestMapper,
    private readonly notifications: NotificationsService,
    private readonly lifecycle: DealRequestLifecycleService,
    private readonly actors: AgencyActorService,
    private readonly agencyService: AgenciesService,
    @Inject(DEAL_REQUEST_AGENCIES) private readonly agencies: DealRequestAgencyDirectory,
    @Inject(DEAL_REQUEST_LISTINGS) private readonly listings: DealRequestListingsPort,
  ) {}

  // ---------------------------------- agency side ----------------------------------

  async create(
    user: UserPrincipal,
    dealRequestId: string,
    input: ProposalCreateInput,
    now: Date = new Date(),
  ): Promise<AgencyProposalView> {
    const actor = await this.actors.resolve(user);
    const req = await this.prisma.dealRequest.findFirst({
      where: { AND: [agencyVisibleWhere(actor, now), { id: dealRequestId }] },
      select: { id: true, status: true, userId: true, dealTypes: true, expiresAt: true },
    });
    if (!req) throw AppException.notFound(ErrorCode.DEAL_REQUEST_NOT_FOUND);
    if (req.status !== DealRequestStatus.OPEN || (req.expiresAt && req.expiresAt <= now)) {
      throw AppException.badRequest(ErrorCode.DEAL_REQUEST_CLOSED);
    }
    if (req.userId === user.userId) throw AppException.badRequest(ErrorCode.PROPOSAL_OWN_REQUEST);
    const termIssues = proposalTermsIssues(req.dealTypes, input);
    if (termIssues.length > 0) {
      throw AppException.badRequest(ErrorCode.PROPOSAL_TERMS_INVALID, termIssues);
    }
    const proposable = await this.listings.proposableIds(actor.agencyId, input.listingIds);
    const invalid = input.listingIds.filter((id) => !proposable.has(id));
    if (invalid.length > 0) {
      throw AppException.badRequest(ErrorCode.PROPOSAL_LISTING_INVALID, { listingIds: invalid });
    }
    const existing = await this.prisma.proposal.findUnique({
      where: { dealRequestId_agencyId: { dealRequestId, agencyId: actor.agencyId } },
      select: { id: true },
    });
    if (existing) throw AppException.conflict(ErrorCode.PROPOSAL_DUPLICATE);

    await this.dailyCaps.consume('PROPOSAL_CREATE', actor.agencyId, now);
    const agencyName = (await this.agencies.names([actor.agencyId])).get(actor.agencyId) ?? '';

    let result: { id: string; sent: Awaited<ReturnType<NotificationsService['createFor']>> };
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
        const sent = await this.notifications.createFor(
          [req.userId],
          {
            type: NotificationType.PROPOSAL_RECEIVED,
            title: '중개사무소의 제안이 도착했습니다.',
            body: agencyName ? `${agencyName}에서 제안을 보냈습니다.` : null,
            data: { dealRequestId, proposalId: proposal.id },
          },
          tx,
        );
        return { id: proposal.id, sent };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw AppException.conflict(ErrorCode.PROPOSAL_DUPLICATE);
      }
      throw err;
    }
    await this.notifications.dispatch(result.sent);
    return this.loadForAgency(actor.agencyId, result.id);
  }

  async withdraw(user: UserPrincipal, id: string): Promise<AgencyProposalView> {
    const actor = await this.actors.resolve(user);
    const p = await this.prisma.proposal.findFirst({
      where: { id, agencyId: actor.agencyId },
      select: { id: true, dealRequestId: true },
    });
    if (!p) throw AppException.notFound(ErrorCode.PROPOSAL_NOT_FOUND);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.proposal.updateMany({
        where: { id, status: { in: [...PROPOSAL_PENDING_STATUSES] } },
        data: { status: ProposalStatus.WITHDRAWN },
      });
      if (count === 0) throw AppException.badRequest(ErrorCode.PROPOSAL_STATE_INVALID);
      await tx.dealRequest.updateMany({
        where: { id: p.dealRequestId, proposalCount: { gt: 0 } },
        data: { proposalCount: { decrement: 1 } },
      });
    });
    return this.loadForAgency(actor.agencyId, id);
  }

  async listForAgency(
    user: UserPrincipal,
    q: AgencyProposalListQuery,
  ): Promise<Paginated<AgencyProposalView>> {
    const actor = await this.actors.resolve(user);
    const where: Prisma.ProposalWhereInput = {
      agencyId: actor.agencyId,
      dealRequest: { deletedAt: null },
      ...(q.status?.length ? { status: { in: q.status } } : {}),
    };
    const page = await paginate(
      q,
      (args) =>
        this.prisma.proposal.findMany({
          where,
          select: proposalAgencySelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
      () => this.prisma.proposal.count({ where }),
    );
    return { ...page, items: page.items.map((p) => this.mapper.proposalForAgency(p)) };
  }

  // -------------------------------- requester side ---------------------------------

  /**
   * Accept a proposal: the request becomes MATCHED and — when `shareContact` (the explicit consent
   * the UI asks for) — the agency gets a contact grant. Other proposals stay as they are.
   */
  async accept(
    user: UserPrincipal,
    id: string,
    input: ProposalAcceptInput,
    now: Date = new Date(),
  ): Promise<ProposalView> {
    const p = await this.findForRequester(user.userId, id);
    if (input.shareContact) {
      const approved = await this.agencies.approvedIds([p.agencyId]);
      if (!approved.has(p.agencyId)) {
        throw AppException.badRequest(ErrorCode.DEAL_REQUEST_GRANT_INVALID);
      }
    }
    const sent = await this.prisma.$transaction(async (tx) => {
      const live = await tx.dealRequest.updateMany({
        where: {
          id: p.dealRequestId,
          deletedAt: null,
          status: { in: [...DEAL_REQUEST_ACTIVE_STATUSES] },
        },
        data: { status: DealRequestStatus.MATCHED },
      });
      if (live.count === 0) throw AppException.badRequest(ErrorCode.DEAL_REQUEST_STATE_INVALID);
      const { count } = await tx.proposal.updateMany({
        where: { id, status: { in: [...PROPOSAL_PENDING_STATUSES] } },
        data: { status: ProposalStatus.ACCEPTED, respondedAt: now },
      });
      if (count === 0) throw AppException.badRequest(ErrorCode.PROPOSAL_STATE_INVALID);
      if (input.shareContact) await this.lifecycle.grant(tx, p.dealRequestId, p.agencyId, now);
      const recipients = (await this.agencies.memberUserIds([p.agencyId], tx)).filter(
        (u) => u !== user.userId,
      );
      return this.notifications.createFor(
        recipients,
        {
          type: NotificationType.PROPOSAL_ACCEPTED,
          title: '제안이 수락되었습니다.',
          body: input.shareContact ? '요청자가 연락처를 공개했습니다.' : null,
          data: {
            dealRequestId: p.dealRequestId,
            proposalId: id,
            contactShared: input.shareContact,
          },
        },
        tx,
      );
    });
    await this.notifications.dispatch(sent);
    return this.loadForRequester(user.userId, id);
  }

  async decline(user: UserPrincipal, id: string, now: Date = new Date()): Promise<ProposalView> {
    const p = await this.findForRequester(user.userId, id);
    const sent = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.proposal.updateMany({
        where: { id, status: { in: [...PROPOSAL_PENDING_STATUSES] } },
        data: { status: ProposalStatus.DECLINED, respondedAt: now },
      });
      if (count === 0) throw AppException.badRequest(ErrorCode.PROPOSAL_STATE_INVALID);
      const recipients = (await this.agencies.memberUserIds([p.agencyId], tx)).filter(
        (u) => u !== user.userId,
      );
      return this.notifications.createFor(
        recipients,
        {
          type: NotificationType.SYSTEM,
          title: '보내신 제안이 거절되었습니다.',
          data: { dealRequestId: p.dealRequestId, proposalId: id },
        },
        tx,
      );
    });
    await this.notifications.dispatch(sent);
    return this.loadForRequester(user.userId, id);
  }

  // ---------------------------------------------------------------------------------

  /** Proposals on the user's own requests; withdrawn ones are invisible to the requester. */
  private async findForRequester(
    userId: string,
    id: string,
  ): Promise<{ id: string; agencyId: string; dealRequestId: string }> {
    const p = await this.prisma.proposal.findFirst({
      where: {
        id,
        status: { not: ProposalStatus.WITHDRAWN },
        dealRequest: { userId, deletedAt: null },
      },
      select: { id: true, agencyId: true, dealRequestId: true },
    });
    if (!p) throw AppException.notFound(ErrorCode.PROPOSAL_NOT_FOUND);
    return p;
  }

  private async loadForRequester(userId: string, id: string): Promise<ProposalView> {
    const p = await this.prisma.proposal.findFirst({
      where: { id, dealRequest: { userId, deletedAt: null } },
      select: {
        ...proposalOwnerSelect,
        dealRequest: {
          select: {
            contactGrants: { where: { revokedAt: null }, select: { agencyId: true } },
          },
        },
      },
    });
    if (!p) throw AppException.notFound(ErrorCode.PROPOSAL_NOT_FOUND);
    const disclosure = await this.agencyService.getDisclosure(p.agencyId);
    const shared = p.dealRequest.contactGrants.some((g) => g.agencyId === p.agencyId);
    return this.mapper.proposalForOwner(p, disclosure, shared);
  }

  private async loadForAgency(agencyId: string, id: string): Promise<AgencyProposalView> {
    const p = await this.prisma.proposal.findFirst({
      where: { id, agencyId },
      select: proposalAgencySelect,
    });
    if (!p) throw AppException.notFound(ErrorCode.PROPOSAL_NOT_FOUND);
    return this.mapper.proposalForAgency(p);
  }
}
