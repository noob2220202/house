import { type AgencyDealRequestView, type AgencyProposalView, type Paginated } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AgencyDealRequestListQueryDto, AgencyProposalListQueryDto, IdParamDto, ListingCandidateQueryDto, ProposalCreateDto } from '../dto';
import { AgencyInboxService } from '../services/agency-inbox.service';
import { ListingCandidatesService, type ListingCandidateView } from '../services/listing-candidates.service';
import { ProposalsService } from '../services/proposals.service';
/**
 * Broker side (/api/v1/agency/...): the inbox of requests visible to the session's agency and the
 * agency's proposals. Membership + approval are checked per request (AgencyActorService).
 */
export declare class AgencyDealRequestsController {
    private readonly inbox;
    private readonly proposals;
    private readonly candidates;
    constructor(inbox: AgencyInboxService, proposals: ProposalsService, candidates: ListingCandidatesService);
    list(user: UserPrincipal, q: AgencyDealRequestListQueryDto): Promise<Paginated<AgencyDealRequestView>>;
    get(user: UserPrincipal, p: IdParamDto): Promise<AgencyDealRequestView>;
    /** The agency's ACTIVE listings for the proposal picker, best match for the request first. */
    listingCandidates(user: UserPrincipal, p: IdParamDto, q: ListingCandidateQueryDto): Promise<Paginated<ListingCandidateView>>;
    propose(user: UserPrincipal, p: IdParamDto, dto: ProposalCreateDto): Promise<AgencyProposalView>;
    listProposals(user: UserPrincipal, q: AgencyProposalListQueryDto): Promise<Paginated<AgencyProposalView>>;
    withdraw(user: UserPrincipal, p: IdParamDto): Promise<AgencyProposalView>;
}
