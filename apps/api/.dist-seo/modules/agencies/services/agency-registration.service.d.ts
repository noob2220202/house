import { AgencyMemberRole, AgencyStatus, type AgencyDocumentInput, type AgencyDocumentView, type AgencyRegisterInput, type AgencyResubmitInput, type AgencyUpdateInput, type ConsentRecordInput, type MyAgency } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AuditService } from '../../../common/audit/audit.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { TermsService } from '../../auth';
import { AgencyMapper } from '../agency.mapper';
import { type AgencyMediaPort } from '../ports/agency-media.port';
import { AgencyCacheService } from './agency-cache.service';
import { AgencySessionSyncService } from './agency-session-sync.service';
/** GET /agencies/mine: the agency plus the caller's role in it (web `myAgencySchema.myRole`). */
export type MyAgencyWithRole = MyAgency & {
    myRole: AgencyMemberRole;
};
/**
 * 중개사무소 등록 신청 (→ PENDING), 반려 후 재신청, the owner's own profile and private documents.
 * "Mine" is the agency the user owns (any status): pending applicants are still role USER.
 */
export declare class AgencyRegistrationService {
    private readonly prisma;
    private readonly config;
    private readonly mapper;
    private readonly cache;
    private readonly sessions;
    private readonly audit;
    private readonly terms;
    private readonly media;
    constructor(prisma: PrismaService, config: AppConfig, mapper: AgencyMapper, cache: AgencyCacheService, sessions: AgencySessionSyncService, audit: AuditService, terms: TermsService, media: AgencyMediaPort);
    register(user: UserPrincipal, input: AgencyRegisterInput): Promise<MyAgency>;
    /**
     * GET /agencies/mine: the owner's agency (any status) with `myRole: OWNER`, or — for staff (B2) —
     * a reduced view of the agency they work for with `myRole: AGENT`: same shape, but no documents,
     * status history or 사업자등록번호 (owner-only data). A rejected applicant who has since joined
     * another office gets that office. 404 when the user neither owns nor works for an agency.
     */
    getMine(user: UserPrincipal): Promise<MyAgencyWithRole>;
    updateMine(user: UserPrincipal, input: AgencyUpdateInput): Promise<MyAgency>;
    /** 반려된 신청 보완 후 재신청: REJECTED → PENDING with a history row. */
    resubmit(user: UserPrincipal, input: AgencyResubmitInput & {
        consents?: ConsentRecordInput[];
    }): Promise<MyAgency>;
    listDocuments(user: UserPrincipal): Promise<AgencyDocumentView[]>;
    addDocument(user: UserPrincipal, input: AgencyDocumentInput): Promise<AgencyDocumentView>;
    removeDocument(user: UserPrincipal, docId: string): Promise<void>;
    /** The user's own (not deleted) agency; 404 when they have none. */
    ownedAgency(userId: string): Promise<{
        id: string;
        status: AgencyStatus;
    }>;
    private findOwned;
    private loadMine;
    /** One application per user, and not while acting for another live agency. */
    private assertCanStartAgency;
    /**
     * 등록번호 is taken only by a live office (APPROVED / SUSPENDED, not deleted), compared on the
     * punctuation/case-insensitive key; the partial unique index agencies_registration_key_live
     * backs it. Pending or rejected applications never reserve a number (a stranger could otherwise
     * park a real office's public 등록번호 and lock it out); approval settles competing ones.
     */
    private assertRegistrationNumberFree;
    private assertDocumentRoom;
    private createDocuments;
    private sggCodeFor;
    /** Optional profile fields → Prisma data; `undefined` leaves a column untouched. */
    private profileData;
}
