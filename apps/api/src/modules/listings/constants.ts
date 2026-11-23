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
} as const;

/** BullMQ job (queue counters-flush) that writes Redis view totals to the DB. */
export const FLUSH_VIEW_COUNTS_JOB = 'listings.flush-view-counts';
export const FLUSH_VIEW_COUNTS_EVERY_MS = 5 * 60_000;
