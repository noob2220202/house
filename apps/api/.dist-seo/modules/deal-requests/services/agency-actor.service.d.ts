import type { UserPrincipal } from '../../../common/auth/principal';
import { AgenciesService } from '../../agencies/services/agencies.service';
import { type DealRequestAgencyDirectory } from '../ports/agency-directory.port';
import type { AgencyScope } from './deal-request-access';
export interface AgencyActor extends AgencyScope {
    memberId: string;
    userId: string;
}
/**
 * Resolves the agency a broker acts for: the session's agency, an ACTIVE membership in it and an
 * APPROVED agency (403 otherwise, via AgenciesService), plus the agency's 시군구 for visibility.
 */
export declare class AgencyActorService {
    private readonly agencies;
    private readonly directory;
    constructor(agencies: AgenciesService, directory: DealRequestAgencyDirectory);
    resolve(user: UserPrincipal): Promise<AgencyActor>;
}
