/** All BullMQ queue names. Modules register the ones they own with BullModule.registerQueue. */
export const QUEUES = {
  /** 국토교통부 실거래가 sync (complexes). */
  TRADE_SYNC: 'trade-sync',
  /** Redis banner counters → banner_stat_daily (ads). */
  BANNER_STATS: 'banner-stats',
  /** sharp → webp variants (media). */
  MEDIA_PROCESSING: 'media-processing',
  /** Popularity counters → DB (listings/complexes view counts). */
  COUNTERS_FLUSH: 'counters-flush',
  /** Notifications fan-out (deal-requests etc.). */
  NOTIFICATIONS: 'notifications',
  /** Expiry, orphan media, PII scrubbing of withdrawn users. */
  CLEANUP: 'cleanup',
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
