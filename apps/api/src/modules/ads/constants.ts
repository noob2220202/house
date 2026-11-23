/** Cache namespaces (CacheService.version/bump) — bumped on every admin write. */
export const ADS_CACHE = {
  BANNERS: 'ads:banners',
  POPUPS: 'ads:popups',
} as const;

/** Upper bound for cached serve responses; the real TTL also stops at the next start/end. */
export const ADS_SERVE_TTL_SECONDS = 60;
export const POPUP_SERVE_LIMIT = 20;

/** Redis keys (auto-prefixed with REDIS_KEY_PREFIX). Sets hold per-day visitor hashes. */
export const ADS_REDIS = {
  impressions: (date: string, bannerId: string) => `ads:imp:${date}:${bannerId}`,
  clicks: (date: string, bannerId: string) => `ads:clk:${date}:${bannerId}`,
  /** ZSET of "<date>:<bannerId>" scored by last-touched epoch ms (pending flush). */
  DIRTY: 'ads:stats:dirty',
} as const;

/** Visitor sets live long enough for late flushes and the live part of the stats endpoint. */
export const ADS_COUNTER_RETENTION_DAYS = 3;
/** Dirty entries touched in the last few seconds stay for the next run (in-flight writes). */
export const ADS_FLUSH_GRACE_MS = 5_000;
export const ADS_FLUSH_BATCH = 500;

export const BANNER_STATS_FLUSH_JOB = 'banner-stats-flush';
export const BANNER_STATS_FLUSH_EVERY_MS = 5 * 60_000;

export const BANNER_STATS_DEFAULT_DAYS = 30;

/** Beacon/click endpoints: generous per-IP limit (pages show several banners). */
export const AD_TRACKING_THROTTLE = { default: { limit: 120, ttl: 60_000 } } as const;
