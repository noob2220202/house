/** Cache keys / TTLs of the home module (Redis keys are auto-prefixed with REDIS_KEY_PREFIX). */
export declare const HOME_CACHE: {
    /** Version namespace bumped by admin policy writes. */
    readonly POLICIES: "home:policies";
};
export declare const HOME_CACHE_TTL_SECONDS: {
    readonly SUMMARY: 120;
    readonly POPULAR_REGIONS: 120;
    readonly SUGGEST: 60;
    readonly POPULAR_KEYWORDS: 300;
    readonly POLICY: 600;
    /** Geocoding results change rarely; an empty answer is retried sooner. */
    readonly GEOCODE: number;
    readonly GEOCODE_EMPTY: number;
};
/** 관심 지역: at most this many keys per user (web MAX_INTEREST_REGIONS). */
export declare const MAX_INTEREST_REGIONS = 5;
/** Naver Cloud Maps (NCP API Gateway) endpoints. */
export declare const NAVER_MAPS: {
    readonly GEOCODE: "https://maps.apigw.ntruss.com/map-geocode/v2/geocode";
    readonly REVERSE_GEOCODE: "https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc";
    readonly TIMEOUT_MS: 5000;
};
/** Address search answers at most this many results. */
export declare const GEOCODE_MAX_RESULTS = 10;
/** Per-route rate limit of GET /geo/geocode (it proxies a metered external API). */
export declare const GEOCODE_THROTTLE: {
    readonly default: {
        readonly limit: 30;
        readonly ttl: 60000;
    };
};
