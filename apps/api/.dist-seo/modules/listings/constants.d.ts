/** Cache namespace bumped whenever publicly visible listing data changes (map tiles). */
export declare const LISTINGS_SEARCH_CACHE_NS = "listings:search";
/** Hot map tiles are cached briefly: invalidation is by version bump, TTL bounds staleness. */
export declare const MAP_TILE_CACHE_TTL_SECONDS = 30;
/** One counted view per viewer per listing within this window. */
export declare const VIEW_DEDUPE_TTL_SECONDS: number;
/** Recent views kept per user and target type. */
export declare const RECENT_VIEWS_CAP = 100;
export declare const LISTINGS_REDIS_KEYS: {
    /** hash listingId → absolute view total (flushed to listings.view_count). */
    readonly viewTotals: "listings:views:totals";
    readonly viewSeen: (listingId: string, viewer: string) => string;
    /** ZSET `${assetType}|${regionKey}` → counted listing views on that KST day (지역 ranking). */
    readonly regionViewsDaily: (day: string) => string;
};
/** Daily region-view ZSETs cover this week and the previous one (rank change), plus slack. */
export declare const REGION_VIEWS_DAILY_TTL_SECONDS: number;
/** BullMQ job (queue counters-flush) that writes Redis view totals to the DB. */
export declare const FLUSH_VIEW_COUNTS_JOB = "listings.flush-view-counts";
export declare const FLUSH_VIEW_COUNTS_EVERY_MS: number;
/**
 * 광고 기간: an ACTIVE/RESERVED listing reverts to DRAFT this many days after publication or its
 * latest 실매물 확인, so ads for already-traded properties don't stay up (제18조의2④).
 */
export declare const LISTING_AD_TTL_DAYS = 30;
/** BullMQ job (queue cleanup) that expires overdue ads. */
export declare const EXPIRE_LISTING_ADS_JOB = "listings.expire-ads";
export declare const EXPIRE_LISTING_ADS_EVERY_MS: number;
export declare const EXPIRE_LISTING_ADS_BATCH = 500;
/**
 * Coarse service-region guard (no 시군구 boundary polygons yet): a property must lie within this
 * distance of the 시군구 centroid (regions table, REGION_SGG_CODE) and, when its 법정동 has a
 * centroid, within EMD_MAX_DISTANCE_M of it.
 */
export declare const SERVICE_REGION_RADIUS_M = 30000;
export declare const EMD_MAX_DISTANCE_M = 15000;
