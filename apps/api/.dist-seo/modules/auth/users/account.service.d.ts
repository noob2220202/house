import { type AuthProvider, type ConsentInput, type ConsentStatus, type IdentitySummary, type MeResponse, type UpdateProfileInput, type WithdrawInput } from '@house/shared';
import type { Identity } from '@prisma/client';
import type { Request, Response } from 'express';
import type { UserPrincipal } from '../../../common/auth/principal';
import { PrismaService } from '../../../prisma/prisma.service';
import { DealRequestMaintenanceService } from '../../deal-requests/services/deal-request-maintenance.service';
import { ListingsModerationService } from '../../listings/services/listings-moderation.service';
import { SessionService } from '../session/session.service';
import { TermsService } from '../terms/terms.service';
import { SuspendedWithdrawStore } from './suspended-withdraw.store';
import { UserSessionService } from './user-session.service';
import { WithdrawnIdentityService } from './withdrawn-identity.service';
export declare function toIdentitySummary(i: Identity): IdentitySummary;
/** The logged-in member's own account: profile, identities, consents, withdrawal. */
export declare class AccountService {
    private readonly prisma;
    private readonly sessions;
    private readonly userSessions;
    private readonly terms;
    private readonly withdrawn;
    private readonly dealRequests;
    private readonly listings;
    private readonly suspendedWithdraw;
    constructor(prisma: PrismaService, sessions: SessionService, userSessions: UserSessionService, terms: TermsService, withdrawn: WithdrawnIdentityService, dealRequests: DealRequestMaintenanceService, listings: ListingsModerationService, suspendedWithdraw: SuspendedWithdrawStore);
    /**
     * /me. Also self-heals the session: a deactivated account loses it (401), and role / acting
     * agency changes made elsewhere (agency approval, admin action) are written back to it.
     */
    me(principal: UserPrincipal): Promise<MeResponse>;
    updateProfile(principal: UserPrincipal, dto: UpdateProfileInput): Promise<MeResponse>;
    identities(principal: UserPrincipal): Promise<IdentitySummary[]>;
    /** Unlinks a provider; the last identity can't go (social login is the only way in). */
    unlink(principal: UserPrincipal, provider: AuthProvider): Promise<IdentitySummary[]>;
    consents(principal: UserPrincipal): Promise<ConsentStatus[]>;
    updateConsents(principal: UserPrincipal, dto: ConsentInput): Promise<ConsentStatus[]>;
    /**
     * 회원 탈퇴 from a logged-in session: see withdrawUser. Logs out everywhere afterwards.
     */
    withdraw(principal: UserPrincipal, dto: WithdrawInput, res: Response): Promise<void>;
    /**
     * 회원 탈퇴: soft delete now (status, sessions, identities, agency memberships), PII scrubbed by
     * the PII scrub job after PII_SCRUB_DELAY_DAYS. Identities are removed at once, but a tombstone
     * keeps the same social account from signing up again for REJOIN_COOLDOWN_DAYS. 내놓기/구하기
     * requests are cancelled and erased (contact, 동·호, address, position, photos) in the same
     * transaction by the deal-requests module, so no agency can reveal them after this point;
     * agencies with live proposals are notified after commit.
     * A suspended member may withdraw too (deletion / 처리정지 rights are not suspended): their PII is
     * then kept for SUSPENDED_PII_RETENTION_DAYS and the rejoin cooldown is as long; reports, audit
     * rows and suspendedReason stay as moderation evidence until the scrub.
     */
    withdrawUser(userId: string, dto: WithdrawInput): Promise<void>;
    /**
     * Ends every agency membership and takes the member's name/phone off the listing ads they were
     * the contact for (moved to the office's 대표). Returns the number of listing links changed.
     */
    private detachMemberships;
    /**
     * POST /auth/withdraw: withdrawal of a suspended member, who has no session. Authenticated by the
     * ticket the refused social login issued (SuspendedWithdrawStore); 401 without a live one.
     * The ticket is spent only on success, so a 409 (still owns an agency) can be retried.
     */
    withdrawWithTicket(req: Request, res: Response, dto: WithdrawInput): Promise<void>;
    private loadActive;
}
