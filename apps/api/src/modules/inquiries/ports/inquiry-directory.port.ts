import {
  AgencyMemberStatus,
  AgencyStatus,
  ListingAgencyStatus,
  PUBLIC_LISTING_STATUSES,
  UserStatus,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { listingTitle } from '../domain/customer';

export interface InquiryAgency {
  id: string;
  name: string;
}

/**
 * Agency / listing / member reads the inquiries module needs beyond AgenciesService (membership
 * of the caller). Neither module exposes a reader for "a public listing this office advertises"
 * or "the members to notify", so this binding reads their tables read-only (as the deal-requests
 * ports do); swap it for exported services once they exist.
 */
export interface InquiryDirectory {
  /** An APPROVED, non-deleted office (null otherwise). */
  approvedAgency(agencyId: string, db?: PrismaTx): Promise<InquiryAgency | null>;
  /**
   * Whether the listing is public (status ACTIVE / RESERVED, not deleted, primary office
   * APPROVED) and the office takes part in it through an ACTIVE listing_agencies row; null
   * otherwise.
   */
  publicListing(listingId: string, agencyId: string, db?: PrismaTx): Promise<InquiryListing | null>;
  /** User ids of the office's ACTIVE members whose account is ACTIVE. */
  memberUserIds(agencyId: string, db?: PrismaTx): Promise<string[]>;
  /** Whether the user is an ACTIVE member of the office (own staff are not customers). */
  isMember(agencyId: string, userId: string): Promise<boolean>;
}

export interface InquiryListing {
  id: string;
  /** Title, else 단지 / building name, else the road address (notification text). */
  title: string;
}

export const INQUIRY_DIRECTORY = Symbol('INQUIRY_DIRECTORY');

@Injectable()
export class PrismaInquiryDirectory implements InquiryDirectory {
  constructor(private readonly prisma: PrismaService) {}

  approvedAgency(agencyId: string, db: PrismaTx = this.prisma): Promise<InquiryAgency | null> {
    return db.agency.findFirst({
      where: { id: agencyId, status: AgencyStatus.APPROVED, deletedAt: null },
      select: { id: true, name: true },
    });
  }

  async publicListing(
    listingId: string,
    agencyId: string,
    db: PrismaTx = this.prisma,
  ): Promise<InquiryListing | null> {
    const row = await db.listing.findFirst({
      where: {
        id: listingId,
        status: { in: [...PUBLIC_LISTING_STATUSES] },
        deletedAt: null,
        primaryAgency: { status: AgencyStatus.APPROVED, deletedAt: null },
        agencies: { some: { agencyId, status: ListingAgencyStatus.ACTIVE } },
      },
      select: {
        id: true,
        title: true,
        complex: { select: { name: true } },
        property: { select: { buildingName: true, roadAddress: true } },
      },
    });
    if (!row) return null;
    return { id: row.id, title: listingTitle(row) };
  }

  async memberUserIds(agencyId: string, db: PrismaTx = this.prisma): Promise<string[]> {
    const rows = await db.agencyMember.findMany({
      where: {
        agencyId,
        status: AgencyMemberStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
      },
      select: { userId: true },
      orderBy: { id: 'asc' },
    });
    return rows.map((r) => r.userId);
  }

  async isMember(agencyId: string, userId: string): Promise<boolean> {
    const n = await this.prisma.agencyMember.count({
      where: { agencyId, userId, status: AgencyMemberStatus.ACTIVE },
    });
    return n > 0;
  }
}
