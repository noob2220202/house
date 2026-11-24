/** Public runtime config (inlined at build time). Never put secrets here. */
export const env = {
  /** API mock mode — the API client targets /mock-api/v1 served by Next route handlers. */
  apiMock: process.env.NEXT_PUBLIC_API_MOCK === '1',
  /** User-site origin for the "사이트 보기" link. */
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  isProd: process.env.NODE_ENV === 'production',
} as const;
