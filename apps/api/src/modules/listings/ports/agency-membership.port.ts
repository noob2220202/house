import { AgencyMemberStatus, AgencyStatus, ErrorCode } from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { PrismaService } from '../../../prisma/prisma.service';

/** The agency member a listing write acts as. */
export interface ListingActor {
  userId: string;
  agencyId: string;
  memberId: string;
  displayName: string;
  phone: string | null;
}

export interface AgencyMemberRef {
  id: string;
  displayName: string;
  phone: string | null;
}

/**
 * What the listings module needs from the agencies domain. Bound to a Prisma implementation
 * until AgenciesService exposes the equivalent (assertActiveMember / findMember).
 */
export interface AgencyMembershipPort {
  /** The principal's ACTIVE membership in its session agency, which must be APPROVED. */
  resolveActor(principal: UserPrincipal): Promise<ListingActor>;
  /** An ACTIVE member of `agencyId`, or null. */
  findActiveMember(agencyId: string, memberId: string): Promise<AgencyMemberRef | null>;
}

export const LISTING_AGENCY_MEMBERSHIP = Symbol('LISTING_AGENCY_MEMBERSHIP');

@Injectable()
export class PrismaAgencyMembership implements AgencyMembershipPort {
  constructor(private readonly prisma: PrismaService) {}

  async resolveActor(principal: UserPrincipal): Promise<ListingActor> {
    if (!principal.agencyId) throw AppException.forbidden(ErrorCode.LISTING_NOT_AGENCY_MEMBER);
    const member = await this.prisma.agencyMember.findUnique({
      where: { agencyId_userId: { agencyId: principal.agencyId, userId: principal.userId } },
      select: {
        id: true,
        status: true,
        displayName: true,
        phone: true,
        agency: { select: { status: true, deletedAt: true } },
      },
    });
    if (!member || member.status !== AgencyMemberStatus.ACTIVE) {
      throw AppException.forbidden(ErrorCode.LISTING_NOT_AGENCY_MEMBER);
    }
    if (member.agency.status !== AgencyStatus.APPROVED || member.agency.deletedAt) {
      throw AppException.forbidden(ErrorCode.LISTING_AGENCY_NOT_ACTIVE);
    }
    return {
      userId: principal.userId,
      agencyId: principal.agencyId,
      memberId: member.id,
      displayName: member.displayName,
      phone: member.phone,
    };
  }

  async findActiveMember(agencyId: string, memberId: string): Promise<AgencyMemberRef | null> {
    return this.prisma.agencyMember.findFirst({
      where: { id: memberId, agencyId, status: AgencyMemberStatus.ACTIVE },
      select: { id: true, displayName: true, phone: true },
    });
  }
}
