import { type AgencyInviteCreateInput, type AgencyInviteView, type AgencyJoinInput, type AgencyMemberUpdateInput, type AgencyMemberView, type MyAgencyMembership, type Paginated, type PaginationQuery } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { PrismaService } from '../../../prisma/prisma.service';
import { TermsService } from '../../auth';
import { type AgencyListingsSync } from '../ports/agency-listings.sync';
import { AgencyCacheService } from './agency-cache.service';
import { AgencyInviteStore } from './agency-invite.store';
import { AgencySessionSyncService } from './agency-session-sync.service';
/**
 * 소속 중개사 관리: the owner issues single-use invite codes, a user redeems one to join as AGENT,
 * the owner edits / removes staff, an agent may leave. Removing or leaving downgrades the user to
 * USER and updates live sessions.
 */
export declare class AgencyMembersService {
    private readonly prisma;
    private readonly invites;
    private readonly cache;
    private readonly sessions;
    private readonly terms;
    private readonly listings;
    constructor(prisma: PrismaService, invites: AgencyInviteStore, cache: AgencyCacheService, sessions: AgencySessionSyncService, terms: TermsService, listings: AgencyListingsSync);
    list(user: UserPrincipal, q: PaginationQuery & {
        includeRemoved: boolean;
    }): Promise<Paginated<AgencyMemberView>>;
    /**
     * Owner edits a staff member. Listing ads copy the contact's name and phone onto each
     * ListingAgency row, so the change is carried there in the same transaction: a member who is no
     * longer advertisable (license flag cleared) is taken off the ads like a departure (contact moves
     * to the 대표), and a rename / new phone of an advertisable member updates their ads (phone only
     * where the row still shows the old member phone, i.e. was not overridden per listing).
     */
    update(user: UserPrincipal, memberId: string, input: AgencyMemberUpdateInput): Promise<AgencyMemberView>;
    remove(user: UserPrincipal, memberId: string): Promise<void>;
    /** The caller's own live membership (owner or agent), or 404. */
    myMembership(user: UserPrincipal): Promise<MyAgencyMembership>;
    /** An AGENT leaves their agency. Owners cannot leave (the agency would be ownerless). */
    leave(user: UserPrincipal): Promise<void>;
    createInvite(user: UserPrincipal, input: AgencyInviteCreateInput): Promise<AgencyInviteView>;
    listInvites(user: UserPrincipal): Promise<AgencyInviteView[]>;
    revokeInvite(user: UserPrincipal, inviteId: string): Promise<void>;
    /** Redeems an invite code: the user becomes an ACTIVE AGENT of the inviting (APPROVED) agency. */
    join(user: UserPrincipal, input: AgencyJoinInput): Promise<MyAgencyMembership>;
    /** The APPROVED agency the user owns (staff can be managed only after approval). */
    private managedAgencyId;
    private findMember;
    private assertCanJoin;
    /** Marks the member REMOVED, downgrades the user and takes them off the agency's listing ads. */
    private deactivate;
    private afterDeparture;
}
