/** Cache namespace bumped whenever publicly visible listing data changes (map tiles). */
export const LISTINGS_SEARCH_CACHE_NS = 'listings:search';
/** Hot map tiles are cached briefly: invalidation is by version bump, TTL bounds staleness. */
export const MAP_TILE_CACHE_TTL_SECONDS = 30;
/** One counted view per viewer per listing within this window. */
export const VIEW_DEDUPE_TTL_SECONDS = 6 * 60 * 60;
/** Recent views kept per user and target type. */
export const RECENT_VIEWS_CAP = 100;

export const LISTINGS_REDIS_KEYS = {
  /** hash listingId → absolute view total (flushed to listings.view_count). */
  viewTotals: 'listings:views:totals',
  viewSeen: (listingId: string, viewer: string): string =>
    `listings:views:seen:${listingId}:${viewer}`,
  /** ZSET `${assetType}|${regionKey}` → counted listing views on that KST day (지역 ranking). */
  regionViewsDaily: (day: string): string => `listings:views:region-daily:${day}`,
} as const;

/** Daily region-view ZSETs cover this week and the previous one (rank change), plus slack. */
export const REGION_VIEWS_DAILY_TTL_SECONDS = 16 * 24 * 60 * 60;

/** BullMQ job (queue counters-flush) that writes Redis view totals to the DB. */
export const FLUSH_VIEW_COUNTS_JOB = 'listings.flush-view-counts';
export const FLUSH_VIEW_COUNTS_EVERY_MS = 5 * 60_000;

/**
 * 광고 기간: an ACTIVE/RESERVED listing reverts to DRAFT this many days after publication or its
 * latest 실매물 확인, so ads for already-traded properties don't stay up (제18조의2④).
 */
export const LISTING_AD_TTL_DAYS = 30;
/** BullMQ job (queue cleanup) that expires overdue ads. */
export const EXPIRE_LISTING_ADS_JOB = 'listings.expire-ads';
export const EXPIRE_LISTING_ADS_EVERY_MS = 60 * 60_000;
export const EXPIRE_LISTING_ADS_BATCH = 500;

/**
 * Coarse service-region guard (no 시군구 boundary polygons yet): a property must lie within this
 * distance of the 시군구 centroid (regions table, REGION_SGG_CODE) and, when its 법정동 has a
 * centroid, within EMD_MAX_DISTANCE_M of it. 순천시 reaches ~32 km from 시청 (주암면 운룡리's
 * point is 31.5 km away), hence 40 km.
 */
export const SERVICE_REGION_RADIUS_M = 40_000;
export const EMD_MAX_DISTANCE_M = 15_000;
