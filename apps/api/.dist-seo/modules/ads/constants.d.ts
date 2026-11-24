/** Cache namespaces (CacheService.version/bump) — bumped on every admin write. */
export declare const ADS_CACHE: {
    readonly BANNERS: "ads:banners";
    readonly POPUPS: "ads:popups";
};
/** Upper bound for cached serve responses; the real TTL also stops at the next start/end. */
export declare const ADS_SERVE_TTL_SECONDS = 60;
export declare const POPUP_SERVE_LIMIT = 20;
/** Redis keys (auto-prefixed with REDIS_KEY_PREFIX). HyperLogLogs of per-day visitor hashes. */
export declare const ADS_REDIS: {
    readonly impressions: (date: string, bannerId: string) => string;
    readonly clicks: (date: string, bannerId: string) => string;
    /** ZSET of "<date>:<bannerId>" scored by last-touched epoch ms (pending flush). */
    readonly DIRTY: "ads:stats:dirty";
};
/** Visitor HLLs live long enough for late flushes and the live part of the stats endpoint. */
export declare const ADS_COUNTER_RETENTION_DAYS = 3;
/** Dirty entries touched in the last few seconds stay for the next run (in-flight writes). */
export declare const ADS_FLUSH_GRACE_MS = 5000;
export declare const ADS_FLUSH_BATCH = 500;
export declare const BANNER_STATS_FLUSH_JOB = "banner-stats-flush";
export declare const BANNER_STATS_FLUSH_EVERY_MS: number;
export declare const BANNER_STATS_DEFAULT_DAYS = 30;
/** Beacon/click endpoints: generous per-IP limit (pages show several banners). */
export declare const AD_TRACKING_THROTTLE: {
    readonly default: {
        readonly limit: 120;
        readonly ttl: 60000;
    };
};
