import { AgencyMemberRole, AgencyMemberStatus } from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { PrismaTx } from '../../../prisma/prisma.service';
import { ListingCountersService } from '../../listings/services/listing-counters.service';

/**
 * Listing side effects of agency changes. The listings module owns those tables; this binding
 * reuses its ListingCountersService (same visibility rule as public search: the primary agency
 * must be APPROVED) and touches listing_agencies contact columns only. Swap it for a
 * ListingsModule-exported service once one exists.
 */
export interface AgencyListingsSync {
  /**
   * The agency's public visibility flipped (suspended / reinstated): recompute the denormalized
   * listing counters of everything its listings count towards. Call inside the transaction.
   */
  agencyVisibilityChanged(tx: PrismaTx, agencyId: string): Promise<void>;
  /**
   * A member left / was removed: their name and phone must stop being advertised. Their listing
   * contacts move to the agency's 대표 (OWNER member), or are cleared if there is none.
   * Returns the number of listing links changed. Call inside the transaction.
   */
  memberDeparted(tx: PrismaTx, agencyId: string, memberId: string): Promise<number>;
  /** Drops cached listing search results / map tiles. Call after the transaction commits. */
  invalidateSearch(): Promise<void>;
}

export const AGENCY_LISTINGS_SYNC = Symbol('AGENCY_LISTINGS_SYNC');

@Injectable()
export class CountersAgencyListingsSync implements AgencyListingsSync {
  constructor(private readonly counters: ListingCountersService) {}

  async agencyVisibilityChanged(tx: PrismaTx, agencyId: string): Promise<void> {
    const [complexes, agencies] = await Promise.all([
      tx.$queryRaw<{ id: string }[]>`
        SELECT DISTINCT l.complex_id::text AS id FROM listings l
        WHERE l.primary_agency_id = ${agencyId}::uuid AND l.complex_id IS NOT NULL`,
      tx.$queryRaw<{ id: string }[]>`
        SELECT DISTINCT la.agency_id::text AS id FROM listing_agencies la
        JOIN listings l ON l.id = la.listing_id
        WHERE l.primary_agency_id = ${agencyId}::uuid`,
    ]);
    await this.counters.refresh(tx, {
      complexIds: complexes.map((c) => c.id),
      agencyIds: [agencyId, ...agencies.map((a) => a.id)],
    });
  }

  async memberDeparted(tx: PrismaTx, agencyId: string, memberId: string): Promise<number> {
    const owner = await tx.agencyMember.findFirst({
      where: {
        agencyId,
        role: AgencyMemberRole.OWNER,
        status: AgencyMemberStatus.ACTIVE,
        id: { not: memberId },
      },
      select: { id: true, displayName: true, phone: true },
    });
    const { count } = await tx.listingAgency.updateMany({
      where: { agencyId, contactMemberId: memberId },
      data: owner
        ? { contactMemberId: owner.id, contactName: owner.displayName, contactPhone: owner.phone }
        : { contactMemberId: null, contactName: null, contactPhone: null },
    });
    return count;
  }

  invalidateSearch(): Promise<void> {
    return this.counters.invalidateSearch();
  }
}
