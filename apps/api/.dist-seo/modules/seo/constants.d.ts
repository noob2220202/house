/** Cache TTLs of the seo module (Redis keys are auto-prefixed with REDIS_KEY_PREFIX). */
export declare const SEO_CACHE_TTL_SECONDS: {
    /** Region index + landing data: counts change with listings, a few minutes is fine for crawlers. */
    readonly REGIONS: 600;
    readonly LANDING: 600;
    /** Monthly report: trades are synced daily at most. */
    readonly REPORT: 3600;
    readonly SITEMAP: 900;
};
/** Google / Naver accept at most 50,000 URLs per sitemap file. */
export declare const SITEMAP_MAX_URLS = 50000;
/** 단지 listed on one landing page (internal links). */
export declare const LANDING_COMPLEX_LIMIT = 50;
/** 최근 실거래 rows on a landing page. */
export declare const LANDING_RECENT_TRADES = 10;
/** Months listed in the report's month navigation. */
export declare const REPORT_MONTHS = 36;
export declare const REPORT_TOP_COMPLEXES = 10;
