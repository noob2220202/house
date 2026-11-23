import { AgencyStatus, ListingAgencyStatus, PUBLIC_LISTING_STATUSES } from '@house/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CacheService } from '../../../common/cache/cache.service';
import type { PrismaTx } from '../../../prisma/prisma.service';
import { LISTINGS_SEARCH_CACHE_NS } from '../constants';

const PUBLIC_STATUSES = Prisma.join(
  PUBLIC_LISTING_STATUSES.map((s) => Prisma.sql`${s}::listing_status`),
);
/** Same visibility rule as public search: the primary agency must be approved. */
const PRIMARY_APPROVED = Prisma.sql`EXISTS (SELECT 1 FROM agencies pa
  WHERE pa.id = l.primary_agency_id AND pa.status = ${AgencyStatus.APPROVED}::agency_status
    AND pa.deleted_at IS NULL)`;

/**
 * Side effects of a change to publicly visible listing data: recompute the denormalized
 * active_listing_count of the affected complexes/agencies (SET from a COUNT, so idempotent) and
 * invalidate cached map tiles.
 *
 * Concurrency (READ COMMITTED): the counter rows are locked FOR UPDATE in a statement of their
 * own before recounting. A single `UPDATE … SET n = (SELECT count(*) …)` that waits on another
 * transaction's row lock re-checks only the target row after that commit; its subquery keeps the
 * statement's older snapshot and would write a count missing the other transaction's change.
 * Locking first means the recount statement starts after the lock is granted, with a fresh
 * snapshot. Lock order is fixed (complexes, then agencies, each by id) to avoid deadlocks between
 * refreshers.
 */
@Injectable()
export class ListingCountersService {
  constructor(private readonly cache: CacheService) {}

  async refresh(
    tx: PrismaTx,
    scope: { complexIds?: (string | null)[]; agencyIds?: string[] },
  ): Promise<void> {
    const complexIds = [...new Set((scope.complexIds ?? []).filter((x): x is string => !!x))];
    const agencyIds = [...new Set(scope.agencyIds ?? [])];
    complexIds.sort();
    agencyIds.sort();
    if (complexIds.length > 0) {
      await tx.$queryRaw`
        SELECT id FROM complexes WHERE id = ANY(${complexIds}::uuid[]) ORDER BY id FOR UPDATE`;
    }
    if (agencyIds.length > 0) {
      await tx.$queryRaw`
        SELECT id FROM agencies WHERE id = ANY(${agencyIds}::uuid[]) ORDER BY id FOR UPDATE`;
    }
    if (complexIds.length > 0) {
      await tx.$executeRaw`
        UPDATE complexes c SET active_listing_count = (
          SELECT count(*)::int FROM listings l
          WHERE l.complex_id = c.id AND l.deleted_at IS NULL AND l.status IN (${PUBLIC_STATUSES})
            AND ${PRIMARY_APPROVED}
        )
        WHERE c.id = ANY(${complexIds}::uuid[])`;
    }
    if (agencyIds.length > 0) {
      await tx.$executeRaw`
        UPDATE agencies a SET active_listing_count = (
          SELECT count(*)::int FROM listing_agencies la
          JOIN listings l ON l.id = la.listing_id
          WHERE la.agency_id = a.id
            AND la.status = ${ListingAgencyStatus.ACTIVE}::listing_agency_status
            AND l.deleted_at IS NULL AND l.status IN (${PUBLIC_STATUSES})
            AND ${PRIMARY_APPROVED}
        )
        WHERE a.id = ANY(${agencyIds}::uuid[])`;
    }
  }

  /** Call after the transaction commits. */
  async invalidateSearch(): Promise<void> {
    await this.cache.bump(LISTINGS_SEARCH_CACHE_NS);
  }
}
