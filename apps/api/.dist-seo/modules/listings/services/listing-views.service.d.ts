import { AssetType } from '@house/shared';
import type Redis from 'ioredis';
import type { Principal } from '../../../common/auth/principal';
import { PrismaService } from '../../../prisma/prisma.service';
/** What a listing view is attributed to in the region ranking. */
export interface ViewRegion {
    assetType: AssetType;
    emdCode: string | null;
}
/** regionKey → asset type → views. */
export type RegionViews = Map<string, Map<AssetType, number>>;
export declare function regionViewMember(assetType: AssetType, regionKey: string): string;
export declare function parseRegionViewMember(member: string): {
    assetType: AssetType;
    regionKey: string;
} | null;
export declare class ListingViewsService {
    private readonly redis;
    private readonly prisma;
    private readonly logger;
    constructor(redis: Redis, prisma: PrismaService);
    /** Stable per-viewer key: the user id, else a hash of IP + user agent (no raw PII in Redis). */
    viewerKey(principal: Principal | undefined): string;
    /**
     * Records a (deduped) view and returns the current total; falls back to `dbCount` on Redis
     * errors. `region` (the listing's asset type + 법정동) feeds the per-region daily view ZSET
     * (signed-in users and anonymous non-bot visitors only).
     */
    record(listingId: string, viewer: string, dbCount: number, region?: ViewRegion | null, now?: Date): Promise<number>;
    /**
     * Counted listing views per (asset type, 지역) summed over the KST days `fromAge` … `toAge`
     * days ago (0 = today), e.g. (0, 6) = this week, (7, 13) = the week before. Empty on Redis errors.
     */
    regionViews(fromAge: number, toAge: number, now?: Date): Promise<RegionViews>;
    /** Writes Redis totals to listings.view_count (idempotent). Returns the number of listings flushed. */
    flush(batchSize?: number): Promise<number>;
}
