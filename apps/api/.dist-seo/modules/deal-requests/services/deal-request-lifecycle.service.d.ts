import { DealRequestStatus } from '@house/shared';
import type { PrismaTx } from '../../../prisma/prisma.service';
import type { DispatchableNotification } from '../notifications/notification-dispatcher';
import { NotificationsService } from '../notifications/notifications.service';
import { type DealRequestAgencyDirectory } from '../ports/agency-directory.port';
export type EndStatus = typeof DealRequestStatus.CLOSED | typeof DealRequestStatus.CANCELLED;
export interface EndRequestInput {
    dealRequestId: string;
    to: EndStatus;
    reason?: string | null;
    /** Revoke every contact grant (cancel / moderation). Completion keeps them. */
    revokeGrants: boolean;
    /** Exclude from agency notifications (the acting requester, if also a broker). */
    actorUserId?: string;
    now: Date;
}
/** State transitions shared by the requester and admin flows. */
export declare class DealRequestLifecycleService {
    private readonly notifications;
    private readonly agencies;
    constructor(notifications: NotificationsService, agencies: DealRequestAgencyDirectory);
    /**
     * OPEN/MATCHED → CLOSED/CANCELLED inside `tx` (conditional update, so concurrent transitions
     * cannot both win) and notifies agencies with live proposals. Returns rows to dispatch after commit.
     */
    end(tx: PrismaTx, input: EndRequestInput): Promise<DispatchableNotification[]>;
    /** Creates or re-activates a contact grant. Returns false when it was already active. */
    grant(tx: PrismaTx, dealRequestId: string, agencyId: string, now: Date): Promise<boolean>;
}
