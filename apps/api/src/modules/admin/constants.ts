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
