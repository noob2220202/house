import { type AgencyDealRequestListQuery, type AgencyDealRequestView, type Paginated } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { PrismaService } from '../../../prisma/prisma.service';
import { DealRequestMapper } from '../deal-request.mapper';
import { AgencyActorService, type AgencyActor } from './agency-actor.service';
/**
 * The agency inbox (/agency/deal-requests). Requests are filtered by the visibility rule; contact
 * fields are loaded in a separate query only for requests whose requester granted this agency.
 */
export declare class AgencyInboxService {
    private readonly prisma;
    private readonly mapper;
    private readonly actors;
    constructor(prisma: PrismaService, mapper: DealRequestMapper, actors: AgencyActorService);
    list(user: UserPrincipal, q: AgencyDealRequestListQuery, now?: Date): Promise<Paginated<AgencyDealRequestView>>;
    get(user: UserPrincipal, id: string, now?: Date): Promise<AgencyDealRequestView>;
    /**
     * Request part of the console dashboard: NEW requests (OPEN, not proposed to yet) by type, and
     * the latest visible requests in the inbox shape (same rows as the first inbox page).
     */
    dashboardFor(actor: AgencyActor, take: number, now?: Date): Promise<{
        newCount: number;
        newSellCount: number;
        newWantedCount: number;
        items: AgencyDealRequestView[];
    }>;
    /**
     * Contact of granted requests whose requester is still ACTIVE: a suspended or withdrawn member's
     * contact is never revealed, even before the scrub job runs.
     */
    private contactsFor;
}
