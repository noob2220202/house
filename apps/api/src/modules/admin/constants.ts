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
/** Keep daily visitor sketches for a while (dashboard shows 7 days; ~12 KB each at most). */
export const VISITOR_KEY_TTL_SECONDS = 60 * 60 * 24 * 40;

/**
 * 신고자 연락처·IP 보유기간: kept this long after the report is closed (for objections and repeat
 * reports), then erased by the admin-maintenance job.
 */
export const REPORT_CONTACT_RETENTION_DAYS = 180;

/** Module-local BullMQ queue for admin housekeeping (not the shared cleanup queue). */
export const ADMIN_QUEUE = 'admin-maintenance';
export const ADMIN_JOBS = { SCRUB_REPORT_CONTACTS: 'admin.scrub-report-contacts' } as const;
/** Daily at 04:41 KST (off-peak, off the hour, away from the auth PII scrub at 04:17). */
export const SCRUB_REPORT_CONTACTS_PATTERN = '41 4 * * *';
