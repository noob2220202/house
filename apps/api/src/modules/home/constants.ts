/** Cache keys / TTLs of the home module (Redis keys are auto-prefixed with REDIS_KEY_PREFIX). */
export const HOME_CACHE = {
  /** Version namespace bumped by admin policy writes. */
  POLICIES: 'home:policies',
} as const;

export const HOME_CACHE_TTL_SECONDS = {
  SUMMARY: 120,
  POPULAR_REGIONS: 120,
  SUGGEST: 60,
  POPULAR_KEYWORDS: 300,
  POLICY: 600,
  /** Geocoding results change rarely; an empty answer is retried sooner. */
  GEOCODE: 24 * 60 * 60,
  GEOCODE_EMPTY: 60 * 60,
} as const;

/** 관심 지역: at most this many keys per user (web MAX_INTEREST_REGIONS). */
export const MAX_INTEREST_REGIONS = 5;

/** Naver Cloud Maps (NCP API Gateway) endpoints. */
export const NAVER_MAPS = {
  GEOCODE: 'https://maps.apigw.ntruss.com/map-geocode/v2/geocode',
  REVERSE_GEOCODE: 'https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc',
  TIMEOUT_MS: 5_000,
} as const;

/** Address search answers at most this many results. */
export const GEOCODE_MAX_RESULTS = 10;
/** Per-route rate limit of GET /geo/geocode (it proxies a metered external API). */
export const GEOCODE_THROTTLE = { default: { limit: 30, ttl: 60_000 } } as const;
