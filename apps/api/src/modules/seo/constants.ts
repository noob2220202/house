/** Cache TTLs of the seo module (Redis keys are auto-prefixed with REDIS_KEY_PREFIX). */
export const SEO_CACHE_TTL_SECONDS = {
  /** Region index + landing data: counts change with listings, a few minutes is fine for crawlers. */
  REGIONS: 600,
  LANDING: 600,
  /** Monthly report: trades are synced daily at most. */
  REPORT: 3600,
  SITEMAP: 900,
} as const;

/** Google / Naver accept at most 50,000 URLs per sitemap file. */
export const SITEMAP_MAX_URLS = 50_000;
/** 단지 listed on one landing page (internal links). */
export const LANDING_COMPLEX_LIMIT = 50;
/** 최근 실거래 rows on a landing page. */
export const LANDING_RECENT_TRADES = 10;
/** Months listed in the report's month navigation. */
export const REPORT_MONTHS = 36;
export const REPORT_TOP_COMPLEXES = 10;
