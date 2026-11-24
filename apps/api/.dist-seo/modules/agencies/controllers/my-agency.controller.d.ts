import { type AgencyDocumentView, type AgencyInviteView, type AgencyMemberView, type MyAgency, type MyAgencyMembership, type Paginated } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AgencyDocumentDto, AgencyDocumentParamDto, AgencyInviteCreateDto, AgencyInviteParamDto, AgencyJoinDto, AgencyMemberListQueryDto, AgencyMemberParamDto, AgencyMemberUpdateDto, AgencyRegisterDto, AgencyResubmitDto, AgencyUpdateDto } from '../dto';
import { AgencyMembersService } from '../services/agency-members.service';
import { AgencyRegistrationService, type MyAgencyWithRole } from '../services/agency-registration.service';
/**
 * The logged-in user's own agency: 등록 신청, profile, documents, staff and invites, joining by
 * code. Registered before the public controller so `/agencies/mine` never hits `/agencies/:id`.
 * Ownership is resolved from the user id in the services (no agency id in these URLs).
 */
export declare class MyAgencyController {
    private readonly registration;
    private readonly members;
    constructor(registration: AgencyRegistrationService, members: AgencyMembersService);
    register(user: UserPrincipal, dto: AgencyRegisterDto): Promise<MyAgency>;
    /** Owner: full view (`myRole: OWNER`); staff: reduced view (`myRole: AGENT`), see the README. */
    getMine(user: UserPrincipal): Promise<MyAgencyWithRole>;
    updateMine(user: UserPrincipal, dto: AgencyUpdateDto): Promise<MyAgency>;
    resubmit(user: UserPrincipal, dto: AgencyResubmitDto): Promise<MyAgency>;
    listDocuments(user: UserPrincipal): Promise<AgencyDocumentView[]>;
    addDocument(user: UserPrincipal, dto: AgencyDocumentDto): Promise<AgencyDocumentView>;
    removeDocument(user: UserPrincipal, p: AgencyDocumentParamDto): Promise<void>;
    listMembers(user: UserPrincipal, q: AgencyMemberListQueryDto): Promise<Paginated<AgencyMemberView>>;
    updateMember(user: UserPrincipal, p: AgencyMemberParamDto, dto: AgencyMemberUpdateDto): Promise<AgencyMemberView>;
    removeMember(user: UserPrincipal, p: AgencyMemberParamDto): Promise<void>;
    listInvites(user: UserPrincipal): Promise<AgencyInviteView[]>;
    createInvite(user: UserPrincipal, dto: AgencyInviteCreateDto): Promise<AgencyInviteView>;
    revokeInvite(user: UserPrincipal, p: AgencyInviteParamDto): Promise<void>;
    /** Redeem an invite code (brute force is limited by the AUTH throttle). */
    join(user: UserPrincipal, dto: AgencyJoinDto): Promise<MyAgencyMembership>;
    membership(user: UserPrincipal): Promise<MyAgencyMembership>;
    leave(user: UserPrincipal): Promise<void>;
}
