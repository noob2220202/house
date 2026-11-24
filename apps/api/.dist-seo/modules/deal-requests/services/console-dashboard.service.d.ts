import type { AgencyDealRequestView } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AgencyDashboardService, type AgencyListingDashboard } from '../../agencies/services/agency-dashboard.service';
import { AgencyActorService } from './agency-actor.service';
import { AgencyInboxService } from './agency-inbox.service';
/** `GET /agencies/mine/dashboard` (web `agencyDashboardSchema`). */
export interface AgencyConsoleDashboard extends AgencyListingDashboard {
    dealRequests: {
        newCount: number;
        newSellCount: number;
        newWantedCount: number;
        items: AgencyDealRequestView[];
    };
    /**
     * Always empty: there is no inquiry backend for launch (DECISIONS D5); the console hides the
     * inquiry widgets. Kept because the web schema requires the object.
     */
    inquiries: {
        unreadCount: number;
        items: never[];
    };
}
/**
 * Console home aggregate: listing / view numbers from the agencies module plus the request feed
 * of the inbox. Lives here because it composes the inbox (deal-requests depends on agencies).
 */
export declare class ConsoleDashboardService {
    private readonly actors;
    private readonly inbox;
    private readonly listings;
    constructor(actors: AgencyActorService, inbox: AgencyInboxService, listings: AgencyDashboardService);
    get(user: UserPrincipal, now?: Date): Promise<AgencyConsoleDashboard>;
}
