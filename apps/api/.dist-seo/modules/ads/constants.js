"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AD_TRACKING_THROTTLE = exports.BANNER_STATS_DEFAULT_DAYS = exports.BANNER_STATS_FLUSH_EVERY_MS = exports.BANNER_STATS_FLUSH_JOB = exports.ADS_FLUSH_BATCH = exports.ADS_FLUSH_GRACE_MS = exports.ADS_COUNTER_RETENTION_DAYS = exports.ADS_REDIS = exports.POPUP_SERVE_LIMIT = exports.ADS_SERVE_TTL_SECONDS = exports.ADS_CACHE = void 0;
/** Cache namespaces (CacheService.version/bump) — bumped on every admin write. */
exports.ADS_CACHE = {
    BANNERS: 'ads:banners',
    POPUPS: 'ads:popups',
};
/** Upper bound for cached serve responses; the real TTL also stops at the next start/end. */
exports.ADS_SERVE_TTL_SECONDS = 60;
exports.POPUP_SERVE_LIMIT = 20;
/** Redis keys (auto-prefixed with REDIS_KEY_PREFIX). HyperLogLogs of per-day visitor hashes. */
exports.ADS_REDIS = {
    impressions: (date, bannerId) => `ads:hll:imp:${date}:${bannerId}`,
    clicks: (date, bannerId) => `ads:hll:clk:${date}:${bannerId}`,
    /** ZSET of "<date>:<bannerId>" scored by last-touched epoch ms (pending flush). */
    DIRTY: 'ads:stats:dirty',
};
/** Visitor HLLs live long enough for late flushes and the live part of the stats endpoint. */
exports.ADS_COUNTER_RETENTION_DAYS = 3;
/** Dirty entries touched in the last few seconds stay for the next run (in-flight writes). */
exports.ADS_FLUSH_GRACE_MS = 5_000;
exports.ADS_FLUSH_BATCH = 500;
exports.BANNER_STATS_FLUSH_JOB = 'banner-stats-flush';
exports.BANNER_STATS_FLUSH_EVERY_MS = 5 * 60_000;
exports.BANNER_STATS_DEFAULT_DAYS = 30;
/** Beacon/click endpoints: generous per-IP limit (pages show several banners). */
exports.AD_TRACKING_THROTTLE = { default: { limit: 120, ttl: 60_000 } };
//# sourceMappingURL=constants.js.map