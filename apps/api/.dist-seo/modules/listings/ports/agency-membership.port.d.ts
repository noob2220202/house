import { AgencyMemberRole } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { PrismaService } from '../../../prisma/prisma.service';
export interface AgencyMemberRef {
    id: string;
    displayName: string;
    phone: string | null;
    role: AgencyMemberRole;
    /** 소속공인중개사 (false = 중개보조원). The OWNER member is the 개업공인중개사. */
    isLicensed: boolean;
}
/** The agency member a listing write acts as. */
export interface ListingActor {
    userId: string;
    agencyId: string;
    memberId: string;
    displayName: string;
    phone: string | null;
    role: AgencyMemberRole;
    isLicensed: boolean;
}
/** 개업공인중개사(OWNER) or 소속공인중개사 — the only people a listing ad may name (제18조의2①). */
export declare function mayBeAdvertised(m: Pick<AgencyMemberRef, 'role' | 'isLicensed'>): boolean;
/**
 * What the listings module needs from the agencies domain. Bound to a Prisma implementation
 * until AgenciesService exposes the equivalent (assertActiveMember / findMember).
 */
export interface AgencyMembershipPort {
    /** The principal's ACTIVE membership in its session agency, which must be APPROVED. */
    resolveActor(principal: UserPrincipal): Promise<ListingActor>;
    /** An ACTIVE member of `agencyId`, or null. */
    findActiveMember(agencyId: string, memberId: string): Promise<AgencyMemberRef | null>;
    /** The agency's ACTIVE OWNER member (대표 개업공인중개사), or null. */
    findRepresentative(agencyId: string): Promise<AgencyMemberRef | null>;
}
export declare const LISTING_AGENCY_MEMBERSHIP: unique symbol;
export declare class PrismaAgencyMembership implements AgencyMembershipPort {
    private readonly prisma;
    constructor(prisma: PrismaService);
    resolveActor(principal: UserPrincipal): Promise<ListingActor>;
    findActiveMember(agencyId: string, memberId: string): Promise<AgencyMemberRef | null>;
    findRepresentative(agencyId: string): Promise<AgencyMemberRef | null>;
}
