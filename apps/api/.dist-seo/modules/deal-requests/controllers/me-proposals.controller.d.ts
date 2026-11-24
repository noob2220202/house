import type { ProposalView } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { IdParamDto, ProposalAcceptDto } from '../dto';
import { ProposalsService } from '../services/proposals.service';
/** The requester answering proposals on their own requests (/api/v1/me/proposals). */
export declare class MyProposalsController {
    private readonly proposals;
    constructor(proposals: ProposalsService);
    accept(user: UserPrincipal, p: IdParamDto, dto: ProposalAcceptDto): Promise<ProposalView>;
    decline(user: UserPrincipal, p: IdParamDto): Promise<ProposalView>;
}
