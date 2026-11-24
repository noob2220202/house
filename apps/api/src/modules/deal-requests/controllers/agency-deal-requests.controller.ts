import {
  UserRole,
  type AgencyDealRequestView,
  type AgencyProposalView,
  type Paginated,
} from '@house/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { UserPrincipal } from '../../../common/auth/principal';
import { CurrentUser, Roles } from '../../../common/decorators';
import { THROTTLE } from '../../../common/throttle/throttle.constants';
import {
  AgencyDealRequestListQueryDto,
  AgencyProposalListQueryDto,
  IdParamDto,
  ListingCandidateQueryDto,
  ProposalCreateDto,
} from '../dto';
import { AgencyInboxService } from '../services/agency-inbox.service';
import {
  ListingCandidatesService,
  type ListingCandidateView,
} from '../services/listing-candidates.service';
import { ProposalsService } from '../services/proposals.service';

/**
 * Broker side (/api/v1/agency/...): the inbox of requests visible to the session's agency and the
 * agency's proposals. Membership + approval are checked per request (AgencyActorService).
 */
@ApiTags('deal-requests')
@Roles(UserRole.AGENT, UserRole.AGENCY_OWNER)
@Controller('agency')
export class AgencyDealRequestsController {
  constructor(
    private readonly inbox: AgencyInboxService,
    private readonly proposals: ProposalsService,
    private readonly candidates: ListingCandidatesService,
  ) {}

  @Get('deal-requests')
  list(
    @CurrentUser() user: UserPrincipal,
    @Query() q: AgencyDealRequestListQueryDto,
  ): Promise<Paginated<AgencyDealRequestView>> {
    return this.inbox.list(user, q);
  }

  @Get('deal-requests/:id')
  get(@CurrentUser() user: UserPrincipal, @Param() p: IdParamDto): Promise<AgencyDealRequestView> {
    return this.inbox.get(user, p.id);
  }

  /** The agency's ACTIVE listings for the proposal picker, best match for the request first. */
  @Get('deal-requests/:id/listing-candidates')
  listingCandidates(
    @CurrentUser() user: UserPrincipal,
    @Param() p: IdParamDto,
    @Query() q: ListingCandidateQueryDto,
  ): Promise<Paginated<ListingCandidateView>> {
    return this.candidates.list(user, p.id, q);
  }

  @Post('deal-requests/:id/proposals')
  @Throttle(THROTTLE.WRITE)
  propose(
    @CurrentUser() user: UserPrincipal,
    @Param() p: IdParamDto,
    @Body() dto: ProposalCreateDto,
  ): Promise<AgencyProposalView> {
    return this.proposals.create(user, p.id, dto);
  }

  @Get('proposals')
  listProposals(
    @CurrentUser() user: UserPrincipal,
    @Query() q: AgencyProposalListQueryDto,
  ): Promise<Paginated<AgencyProposalView>> {
    return this.proposals.listForAgency(user, q);
  }

  @Post('proposals/:id/withdraw')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE.WRITE)
  withdraw(
    @CurrentUser() user: UserPrincipal,
    @Param() p: IdParamDto,
  ): Promise<AgencyProposalView> {
    return this.proposals.withdraw(user, p.id);
  }
}
