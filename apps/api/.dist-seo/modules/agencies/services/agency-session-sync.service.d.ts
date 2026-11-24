import type { UserRole } from '@house/shared';
import { SessionService } from '../../auth';
/**
 * Keeps live Redis sessions in step with agency membership changes (role / acting agency), so the
 * user does not have to log in again after approval, joining or removal. Failures are logged and
 * never fail the request: the next login recomputes both from the database anyway.
 */
export declare class AgencySessionSyncService {
    private readonly sessions;
    private readonly logger;
    constructor(sessions: SessionService);
    apply(userId: string, patch: {
        role?: UserRole;
        agencyId?: string | null;
    }): Promise<void>;
}
