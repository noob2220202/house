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

/** Kakao Local API endpoints (header `Authorization: KakaoAK <REST API 키>`). */
export const KAKAO_LOCAL = {
  /** 주소 검색: address → coordinates + 도로명/지번 + 법정동 code (`address.b_code`). */
  ADDRESS_SEARCH: 'https://dapi.kakao.com/v2/local/search/address.json',
  /** 좌표 → 행정구역: the 법정동 (`region_type: 'B'`) code of a point. */
  COORD_TO_REGION: 'https://dapi.kakao.com/v2/local/geo/coord2regioncode.json',
  TIMEOUT_MS: 5_000,
} as const;

/** Address search answers at most this many results. */
export const GEOCODE_MAX_RESULTS = 10;
/** Per-route rate limit of GET /geo/geocode (it proxies a metered external API). */
export const GEOCODE_THROTTLE = { default: { limit: 30, ttl: 60_000 } } as const;
