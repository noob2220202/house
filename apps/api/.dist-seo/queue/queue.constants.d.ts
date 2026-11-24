/** All BullMQ queue names. Modules register the ones they own with BullModule.registerQueue. */
export declare const QUEUES: {
    /** 국토교통부 실거래가 sync (complexes). */
    readonly TRADE_SYNC: "trade-sync";
    /** Redis banner counters → banner_stat_daily (ads). */
    readonly BANNER_STATS: "banner-stats";
    /** sharp → webp variants (media). */
    readonly MEDIA_PROCESSING: "media-processing";
    /** Popularity counters → DB (listings/complexes view counts). */
    readonly COUNTERS_FLUSH: "counters-flush";
    /** Notifications fan-out (deal-requests etc.). */
    readonly NOTIFICATIONS: "notifications";
    /** Expiry, orphan media, PII scrubbing of withdrawn users. */
    readonly CLEANUP: "cleanup";
};
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
