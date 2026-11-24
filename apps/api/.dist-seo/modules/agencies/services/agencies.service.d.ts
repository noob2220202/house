import { AgencyMemberRole, AgencyStatus, type AgencyDisclosure } from '@house/shared';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { AgencyCacheService } from './agency-cache.service';
export interface ActiveMember {
    memberId: string;
    agencyId: string;
    userId: string;
    role: AgencyMemberRole;
    displayName: string;
    phone: string | null;
    agencyStatus: AgencyStatus;
}
export interface AssertMemberOptions {
    /** Require the agency to be APPROVED (default true): PENDING/SUSPENDED agencies cannot act. */
    requireApproved?: boolean;
    /** Require the OWNER member role. */
    requireOwner?: boolean;
}
/**
 * Public surface of the agencies module for other modules (listings, deal-requests, admin):
 * membership checks, 표시·광고 disclosure data and warnings. Import AgenciesModule and inject this;
 * do not query agency tables directly.
 */
export declare class AgenciesService {
    private readonly prisma;
    private readonly cache;
    constructor(prisma: PrismaService, cache: AgencyCacheService);
    /**
     * The user's ACTIVE membership in `agencyId`. Throws 403 AGENCY_MEMBERSHIP_REQUIRED when the
     * user is not an active member, AGENCY_NOT_APPROVED when the agency cannot act.
     */
    assertActiveMember(userId: string, agencyId: string | null | undefined, opts?: AssertMemberOptions, db?: PrismaTx): Promise<ActiveMember>;
    /** An ACTIVE member of `agencyId` by member id (e.g. the contact person of a listing), or null. */
    findActiveMember(agencyId: string, memberId: string): Promise<{
        id: string;
        displayName: string;
        phone: string | null;
    } | null>;
    /** Whether the agency exists, is not deleted and is APPROVED. */
    isApproved(agencyId: string): Promise<boolean>;
    /**
     * 표시·광고 명시사항 of an APPROVED agency (명칭·소재지·연락처·등록번호·대표자 성명), or null when the
     * agency cannot advertise. Listings feed this into the publish validator and the ad footer.
     */
    getDisclosure(agencyId: string, db?: PrismaTx): Promise<AgencyDisclosure | null>;
    /** Batch variant (no N+1): agencyId → disclosure, APPROVED agencies only. */
    getDisclosures(agencyIds: readonly string[]): Promise<Map<string, AgencyDisclosure>>;
    /**
     * Records a warning (e.g. a resolved 허위매물 report) and bumps the denormalized counter.
     * Pass `tx` to join the caller's transaction (the caller writes the audit log).
     */
    recordWarning(input: {
        agencyId: string;
        reason: string;
        reportId?: string | null;
        adminId?: string | null;
    }, tx?: PrismaTx): Promise<{
        id: string;
    }>;
}
