import { ListingAgencyStatus, ListingStatus } from '@house/shared';
import { Injectable } from '@nestjs/common';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';

/**
 * Listing reads for proposals. ListingsModule exposes no reader for "listings this agency may
 * advertise", so this binding reads the listing tables read-only; swap it once one exists.
 */
export interface DealRequestListingsPort {
  /** The subset of `ids` that are ACTIVE listings the agency actively (co-)brokers. */
  proposableIds(agencyId: string, ids: readonly string[], db?: PrismaTx): Promise<Set<string>>;
}

export const DEAL_REQUEST_LISTINGS = Symbol('DEAL_REQUEST_LISTINGS');

@Injectable()
export class PrismaDealRequestListings implements DealRequestListingsPort {
  constructor(private readonly prisma: PrismaService) {}

  async proposableIds(
    agencyId: string,
    ids: readonly string[],
    db: PrismaTx = this.prisma,
  ): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await db.listing.findMany({
      where: {
        id: { in: [...ids] },
        status: ListingStatus.ACTIVE,
        deletedAt: null,
        agencies: { some: { agencyId, status: ListingAgencyStatus.ACTIVE } },
      },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }
}
