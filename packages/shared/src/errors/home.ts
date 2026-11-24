// Owned by the home module team (home counters, search, geocoding, policy pages, 관심 중개사무소/지역).
export const HomeErrorCode = {
  /** 404: no published, effective version of the policy page (GET /policies/:slug, admin edits). */
  POLICY_NOT_FOUND: 'POLICY_NOT_FOUND',
  /** 503: address geocoding is not configured or the provider failed (GET /geo/geocode). */
  GEOCODE_UNAVAILABLE: 'GEOCODE_UNAVAILABLE',
} as const;

export const HOME_ERROR_MESSAGES: Record<keyof typeof HomeErrorCode, string> = {
  POLICY_NOT_FOUND: '정책 문서를 찾을 수 없습니다.',
  GEOCODE_UNAVAILABLE: '지금은 주소 검색을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
};
