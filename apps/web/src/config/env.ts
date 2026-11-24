/** Public runtime config (inlined at build time). Never put secrets here. */
export const env = {
  /** API mock mode — the API client targets /mock-api/v1 served by Next route handlers. */
  apiMock: process.env.NEXT_PUBLIC_API_MOCK === '1',
  /** Public site origin without trailing slash. */
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  /** Naver Maps (NCP) key id; empty → StaticMapView. */
  naverMapKeyId: process.env.NEXT_PUBLIC_NAVER_MAP_KEY_ID || '',
  isProd: process.env.NODE_ENV === 'production',
} as const;
