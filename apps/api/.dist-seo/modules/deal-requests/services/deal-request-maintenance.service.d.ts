import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import type { DispatchableNotification } from '../notifications/notification-dispatcher';
import { NotificationsService } from '../notifications/notifications.service';
import { type DealRequestAgencyDirectory } from '../ports/agency-directory.port';
import { type DealRequestMediaPort } from '../ports/media.port';
/**
 * Background work of the module (run by DealRequestsProcessor; e2e calls these directly). Every
 * method is idempotent and safe to run concurrently with itself.
 */
export declare class DealRequestMaintenanceService {
    private readonly prisma;
    private readonly notifications;
    private readonly agencies;
    private readonly media;
    private readonly logger;
    constructor(prisma: PrismaService, notifications: NotificationsService, agencies: DealRequestAgencyDirectory, media: DealRequestMediaPort);
    /**
     * Notifies every broker who can see a new OPEN request (DEAL_REQUEST_RECEIVED). Serialized per
     * request with an advisory lock; users already notified for it are skipped, so retries and
     * duplicate jobs never notify twice.
     */
    fanout(dealRequestId: string): Promise<number>;
    /**
     * OPEN requests past expiresAt → EXPIRED, with a notice to the requester. MATCHED requests never
     * expire: an agency is mid-deal with the requester, who ends the request by closing or cancelling
     * it. Expired requests can be reopened with POST /me/deal-requests/:id/extend.
     */
    expireDue(now?: Date): Promise<number>;
    /**
     * Data minimization, two passes:
     *  - requests that ended more than CONTACT_RETENTION_DAYS ago lose contact name/phone and 동·호;
     *  - requests of withdrawn members are cancelled (agencies told) and lose everything identifying
     *    (see eraseWithdrawn). AccountService.withdraw should do this at once via scrubUser; this pass
     *    is the safety net.
     * Contact grants are revoked with both.
     */
    scrubDue(now?: Date): Promise<number>;
    /**
     * Immediate erasure for one member (회원 탈퇴): cancels the member's live requests (notifying
     * agencies with live proposals), revokes every contact grant, and erases contact, 동·호, address,
     * position, floor, area, description and photos of all their requests.
     *
     * With `tx` (e.g. the withdrawal transaction) the caller must pass the returned notices to
     * `dispatch` after commit; without it, this runs its own transaction and dispatches itself.
     */
    scrubUser(userId: string, now?: Date, tx?: PrismaTx): Promise<DispatchableNotification[]>;
    /** Best-effort delivery of notices returned by `scrubUser(…, tx)` once its transaction commits. */
    dispatch(notices: readonly DispatchableNotification[]): Promise<void>;
    private eraseWithdrawn;
    /** Same notice as DealRequestLifecycleService.end, for agencies with live proposals. */
    private notifyCancelled;
    private revokeGrants;
    private notYetNotified;
}
