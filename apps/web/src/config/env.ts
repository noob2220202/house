/** Public site origin without trailing slash. */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

/** Hostname of an origin ("https://suncheonmap.kr" → "suncheonmap.kr"); '' when unparsable. */
function hostnameOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return '';
  }
}

/** Public runtime config (inlined at build time). Never put secrets here. */
export const env = {
  /** API mock mode — the API client targets /mock-api/v1 served by Next route handlers. */
  apiMock: process.env.NEXT_PUBLIC_API_MOCK === '1',
  siteUrl,
  /**
   * Domain the 사무소 홈페이지 hosts live under (`<slug>.<siteRootDomain>`). Defaults to the hostname
   * of `siteUrl`, the same way the API derives `SITE_ROOT_DOMAIN` from `PUBLIC_BASE_URL`; set both
   * only when the main site is not on the bare domain (e.g. a `www.` host).
   */
  siteRootDomain: (process.env.NEXT_PUBLIC_SITE_ROOT_DOMAIN || hostnameOf(siteUrl))
    .trim()
    .toLowerCase()
    .replace(/\.$/, ''),
  /** Kakao Maps JavaScript 키 (public; restricted to the registered site domains); empty → StaticMapView. */
  kakaoMapKey: process.env.NEXT_PUBLIC_KAKAO_MAP_KEY || '',
  isProd: process.env.NODE_ENV === 'production',
} as const;
