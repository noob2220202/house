"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GEOCODE_THROTTLE = exports.GEOCODE_MAX_RESULTS = exports.NAVER_MAPS = exports.MAX_INTEREST_REGIONS = exports.HOME_CACHE_TTL_SECONDS = exports.HOME_CACHE = void 0;
/** Cache keys / TTLs of the home module (Redis keys are auto-prefixed with REDIS_KEY_PREFIX). */
exports.HOME_CACHE = {
    /** Version namespace bumped by admin policy writes. */
    POLICIES: 'home:policies',
};
exports.HOME_CACHE_TTL_SECONDS = {
    SUMMARY: 120,
    POPULAR_REGIONS: 120,
    SUGGEST: 60,
    POPULAR_KEYWORDS: 300,
    POLICY: 600,
    /** Geocoding results change rarely; an empty answer is retried sooner. */
    GEOCODE: 24 * 60 * 60,
    GEOCODE_EMPTY: 60 * 60,
};
/** 관심 지역: at most this many keys per user (web MAX_INTEREST_REGIONS). */
exports.MAX_INTEREST_REGIONS = 5;
/** Naver Cloud Maps (NCP API Gateway) endpoints. */
exports.NAVER_MAPS = {
    GEOCODE: 'https://maps.apigw.ntruss.com/map-geocode/v2/geocode',
    REVERSE_GEOCODE: 'https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc',
    TIMEOUT_MS: 5_000,
};
/** Address search answers at most this many results. */
exports.GEOCODE_MAX_RESULTS = 10;
/** Per-route rate limit of GET /geo/geocode (it proxies a metered external API). */
exports.GEOCODE_THROTTLE = { default: { limit: 30, ttl: 60_000 } };
//# sourceMappingURL=constants.js.map