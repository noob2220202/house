"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REPORT_TOP_COMPLEXES = exports.REPORT_MONTHS = exports.LANDING_RECENT_TRADES = exports.LANDING_COMPLEX_LIMIT = exports.SITEMAP_MAX_URLS = exports.SEO_CACHE_TTL_SECONDS = void 0;
/** Cache TTLs of the seo module (Redis keys are auto-prefixed with REDIS_KEY_PREFIX). */
exports.SEO_CACHE_TTL_SECONDS = {
    /** Region index + landing data: counts change with listings, a few minutes is fine for crawlers. */
    REGIONS: 600,
    LANDING: 600,
    /** Monthly report: trades are synced daily at most. */
    REPORT: 3600,
    SITEMAP: 900,
};
/** Google / Naver accept at most 50,000 URLs per sitemap file. */
exports.SITEMAP_MAX_URLS = 50_000;
/** 단지 listed on one landing page (internal links). */
exports.LANDING_COMPLEX_LIMIT = 50;
/** 최근 실거래 rows on a landing page. */
exports.LANDING_RECENT_TRADES = 10;
/** Months listed in the report's month navigation. */
exports.REPORT_MONTHS = 36;
exports.REPORT_TOP_COMPLEXES = 10;
//# sourceMappingURL=constants.js.map