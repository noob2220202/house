import { Injectable } from '@nestjs/common';
import {
  DealType,
  enumValues,
  PUBLIC_LISTING_STATUSES,
  type ComplexListingCounts,
  type ComplexListingsSummary,
  type DealTypeListingSummary,
} from '@house/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PUBLIC_PRIMARY_AGENCY_WHERE } from '../../listings/listing.selects';

const DEAL_TYPES = enumValues(DealType);

/**
 * Same disclosure rule as public listing search/detail: 광고중/계약중, not deleted, and the
 * primary agency is disclosable (approved, not deleted). Listings of a SUSPENDED/REJECTED office
 * stay ACTIVE in the table but must not be counted on 단지 pages.
 */
const PUBLIC_LISTING_WHERE = {
  deletedAt: null,
  status: { in: [...PUBLIC_LISTING_STATUSES] },
  ...PUBLIC_PRIMARY_AGENCY_WHERE,
} as const satisfies Prisma.ListingWhereInput;

function emptyCounts(): ComplexListingCounts {
  return {
    total: 0,
    byDealType: Object.fromEntries(DEAL_TYPES.map((d) => [d, 0])) as Record<DealType, number>,
  };
}

/** Read-only aggregates over publicly visible listings for 단지 pages (listings module owns writes). */
@Injectable()
export class ComplexListingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active (광고중/계약중) listing count, price range and 월세 range per deal type. */
  async summary(complexId: string): Promise<ComplexListingsSummary> {
    const groups = await this.prisma.listing.groupBy({
      by: ['dealType'],
      where: { complexId, ...PUBLIC_LISTING_WHERE },
      _count: { _all: true },
      _min: { priceSort: true, monthlyRent: true },
      _max: { priceSort: true, monthlyRent: true },
    });
    const byType = new Map(groups.map((g) => [g.dealType, g]));
    const byDealType: DealTypeListingSummary[] = DEAL_TYPES.map((dealType) => {
      const g = byType.get(dealType);
      const monthly = dealType === DealType.MONTHLY;
      return {
        dealType,
        count: g?._count._all ?? 0,
        minPrice: g?._min.priceSort ?? null,
        maxPrice: g?._max.priceSort ?? null,
        minMonthlyRent: monthly ? (g?._min.monthlyRent ?? null) : null,
        maxMonthlyRent: monthly ? (g?._max.monthlyRent ?? null) : null,
      };
    });
    return {
      complexId,
      total: byDealType.reduce((n, d) => n + d.count, 0),
      byDealType,
    };
  }

  /** Per-deal-type active listing counts for many complexes in one query (no N+1). */
  async countsFor(complexIds: readonly string[]): Promise<Map<string, ComplexListingCounts>> {
    const out = new Map<string, ComplexListingCounts>(complexIds.map((id) => [id, emptyCounts()]));
    if (complexIds.length === 0) return out;
    const groups = await this.prisma.listing.groupBy({
      by: ['complexId', 'dealType'],
      where: { complexId: { in: [...complexIds] }, ...PUBLIC_LISTING_WHERE },
      _count: { _all: true },
    });
    for (const g of groups) {
      const c = g.complexId ? out.get(g.complexId) : undefined;
      if (!c) continue;
      c.byDealType[g.dealType] = g._count._all;
      c.total += g._count._all;
    }
    return out;
  }
}
