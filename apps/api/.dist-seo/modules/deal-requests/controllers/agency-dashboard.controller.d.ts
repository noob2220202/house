import type { UserPrincipal } from '../../../common/auth/principal';
import { ConsoleDashboardService, type AgencyConsoleDashboard } from '../services/console-dashboard.service';
/**
 * Broker console home (/api/v1/agencies/mine/dashboard): AGENT / AGENCY_OWNER acting for an
 * APPROVED agency with an ACTIVE membership (403 otherwise, as the inbox).
 */
export declare class AgencyDashboardController {
    private readonly dashboard;
    constructor(dashboard: ConsoleDashboardService);
    get(user: UserPrincipal): Promise<AgencyConsoleDashboard>;
}
