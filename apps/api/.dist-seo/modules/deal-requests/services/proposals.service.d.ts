import { type AgencyProposalListQuery, type AgencyProposalView, type Paginated, type ProposalAcceptInput, type ProposalCreateInput, type ProposalView } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { DailyCapService } from '../../../common/throttle/daily-cap.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgenciesService } from '../../agencies/services/agencies.service';
import { DealRequestMapper } from '../deal-request.mapper';
import { NotificationsService } from '../notifications/notifications.service';
import { type DealRequestAgencyDirectory } from '../ports/agency-directory.port';
import { type DealRequestListingsPort } from '../ports/listings.port';
import { AgencyActorService } from './agency-actor.service';
import { DealRequestLifecycleService } from './deal-request-lifecycle.service';
/** Proposals: agencies send/withdraw them; the requester accepts (optionally sharing contact) or declines. */
export declare class ProposalsService {
    private readonly prisma;
    private readonly dailyCaps;
    private readonly mapper;
    private readonly notifications;
    private readonly lifecycle;
    private readonly actors;
    private readonly agencyService;
    private readonly agencies;
    private readonly listings;
    constructor(prisma: PrismaService, dailyCaps: DailyCapService, mapper: DealRequestMapper, notifications: NotificationsService, lifecycle: DealRequestLifecycleService, actors: AgencyActorService, agencyService: AgenciesService, agencies: DealRequestAgencyDirectory, listings: DealRequestListingsPort);
    create(user: UserPrincipal, dealRequestId: string, input: ProposalCreateInput, now?: Date): Promise<AgencyProposalView>;
    withdraw(user: UserPrincipal, id: string): Promise<AgencyProposalView>;
    listForAgency(user: UserPrincipal, q: AgencyProposalListQuery): Promise<Paginated<AgencyProposalView>>;
    /**
     * Accept a proposal: the request becomes MATCHED and — when `shareContact` (the explicit consent
     * the UI asks for) — the agency gets a contact grant. Other proposals stay as they are.
     */
    accept(user: UserPrincipal, id: string, input: ProposalAcceptInput, now?: Date): Promise<ProposalView>;
    decline(user: UserPrincipal, id: string, now?: Date): Promise<ProposalView>;
    /** Proposals on the user's own requests; withdrawn ones are invisible to the requester. */
    private findForRequester;
    private loadForRequester;
    private loadForAgency;
}
