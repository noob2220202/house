import { CacheService } from '../../../common/cache/cache.service';
import type { PrismaTx } from '../../../prisma/prisma.service';
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
export declare class ListingCountersService {
    private readonly cache;
    constructor(cache: CacheService);
    refresh(tx: PrismaTx, scope: {
        complexIds?: (string | null)[];
        agencyIds?: string[];
    }): Promise<void>;
    /** Call after the transaction commits. */
    invalidateSearch(): Promise<void>;
}
