"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCRUB_REPORT_CONTACTS_PATTERN = exports.PURGE_NOTIFICATIONS_PATTERN = exports.SYNC_NOTIFICATIONS_EVERY_MS = exports.ADMIN_JOBS = exports.ADMIN_QUEUE = exports.REPORT_CONTACT_RETENTION_DAYS = exports.STATS_CACHE_TTL_SECONDS = exports.VISITOR_KEY_TTL_SECONDS = exports.DEVICE_KEY_PREFIX = exports.PAGEVIEW_KEY_PREFIX = exports.VISITOR_KEY_PREFIX = exports.DASHBOARD_CACHE_TTL_SECONDS = exports.SITE_SETTINGS_CACHE_TTL_SECONDS = exports.CONTENT_CACHE_TTL_SECONDS = exports.ADMIN_CACHE = void 0;
/** Cache namespaces (CacheService.version/bump) of the admin module. */
exports.ADMIN_CACHE = {
    /** Public notices / FAQ / videos lists. */
    CONTENT: 'admin:content',
    SITE_SETTINGS: 'admin:site-settings',
};
exports.CONTENT_CACHE_TTL_SECONDS = 60;
exports.SITE_SETTINGS_CACHE_TTL_SECONDS = 300;
exports.DASHBOARD_CACHE_TTL_SECONDS = 30;
/** HyperLogLog of unique visitors per KST day: `admin:visitors:<YYYYMMDD>`. */
exports.VISITOR_KEY_PREFIX = 'admin:visitors:';
/** Counted visitor requests per KST day (stats `pageViews`): `admin:pageviews:<YYYYMMDD>`. */
exports.PAGEVIEW_KEY_PREFIX = 'admin:pageviews:';
/** Hash { mobile, desktop } of counted requests per KST day: `admin:devices:<YYYYMMDD>`. */
exports.DEVICE_KEY_PREFIX = 'admin:devices:';
/**
 * Keep daily visitor sketches and counters long enough for the 90-day stats view and its
 * comparison period (~12 KB per sketch at most).
 */
exports.VISITOR_KEY_TTL_SECONDS = 60 * 60 * 24 * 200;
/** Stats sections are cached briefly (aggregates over up to 180 days). */
exports.STATS_CACHE_TTL_SECONDS = 120;
/**
 * 신고자 연락처·IP 보유기간: kept this long after the report is closed (for objections and repeat
 * reports), then erased by the admin-maintenance job.
 */
exports.REPORT_CONTACT_RETENTION_DAYS = 180;
/** Module-local BullMQ queue for admin housekeeping (not the shared cleanup queue). */
exports.ADMIN_QUEUE = 'admin-maintenance';
exports.ADMIN_JOBS = {
    SCRUB_REPORT_CONTACTS: 'admin.scrub-report-contacts',
    SYNC_NOTIFICATIONS: 'admin.sync-notifications',
    PURGE_NOTIFICATIONS: 'admin.purge-notifications',
};
/** Back-office notifications are derived from the source tables every 5 minutes. */
exports.SYNC_NOTIFICATIONS_EVERY_MS = 5 * 60_000;
/** Daily at 04:53 KST: drop notifications past their retention period. */
exports.PURGE_NOTIFICATIONS_PATTERN = '53 4 * * *';
/** Daily at 04:41 KST (off-peak, off the hour, away from the auth PII scrub at 04:17). */
exports.SCRUB_REPORT_CONTACTS_PATTERN = '41 4 * * *';
//# sourceMappingURL=constants.js.map