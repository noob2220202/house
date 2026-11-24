/** Cache namespaces (CacheService.version/bump) of the admin module. */
export const ADMIN_CACHE = {
  /** Public notices / FAQ / videos lists. */
  CONTENT: 'admin:content',
  SITE_SETTINGS: 'admin:site-settings',
} as const;

export const CONTENT_CACHE_TTL_SECONDS = 60;
export const SITE_SETTINGS_CACHE_TTL_SECONDS = 300;
export const DASHBOARD_CACHE_TTL_SECONDS = 30;

/** HyperLogLog of unique visitors per KST day: `admin:visitors:<YYYYMMDD>`. */
export const VISITOR_KEY_PREFIX = 'admin:visitors:';
/** Counted visitor requests per KST day (stats `pageViews`): `admin:pageviews:<YYYYMMDD>`. */
export const PAGEVIEW_KEY_PREFIX = 'admin:pageviews:';
/** Hash { mobile, desktop } of counted requests per KST day: `admin:devices:<YYYYMMDD>`. */
export const DEVICE_KEY_PREFIX = 'admin:devices:';
/**
 * Keep daily visitor sketches and counters long enough for the 90-day stats view and its
 * comparison period (~12 KB per sketch at most).
 */
export const VISITOR_KEY_TTL_SECONDS = 60 * 60 * 24 * 200;
/** Stats sections are cached briefly (aggregates over up to 180 days). */
export const STATS_CACHE_TTL_SECONDS = 120;

/**
 * 신고자 연락처·IP 보유기간: kept this long after the report is closed (for objections and repeat
 * reports), then erased by the admin-maintenance job. Shared, so the report dialog's notice
 * (apps/web ReportDialog) states the same period.
 */
export { REPORT_CONTACT_RETENTION_DAYS } from '@house/shared';

/** Module-local BullMQ queue for admin housekeeping (not the shared cleanup queue). */
export const ADMIN_QUEUE = 'admin-maintenance';
export const ADMIN_JOBS = {
  SCRUB_REPORT_CONTACTS: 'admin.scrub-report-contacts',
  SYNC_NOTIFICATIONS: 'admin.sync-notifications',
  PURGE_NOTIFICATIONS: 'admin.purge-notifications',
} as const;
/** Back-office notifications are derived from the source tables every 5 minutes. */
export const SYNC_NOTIFICATIONS_EVERY_MS = 5 * 60_000;
/** Daily at 04:53 KST: drop notifications past their retention period. */
export const PURGE_NOTIFICATIONS_PATTERN = '53 4 * * *';
/** Daily at 04:41 KST (off-peak, off the hour, away from the auth PII scrub at 04:17). */
export const SCRUB_REPORT_CONTACTS_PATTERN = '41 4 * * *';
