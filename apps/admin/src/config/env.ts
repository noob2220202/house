const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

/**
 * Domain the 사무소 홈페이지 live under (`<slug>.<root>`): `explicit` (NEXT_PUBLIC_SITE_ROOT_DOMAIN)
 * if set, else the plain hostname of the user-site URL — the same rule as the web app
 * (`apps/web/src/config/env.ts`) and the API (`AppConfigService.siteRootDomain`). A "www." host
 * is kept as is: when the main site is on `www.`, set the root domain explicitly in all three.
 */
export function siteRootDomainOf(url: string, explicit?: string | null): string {
  let root = explicit?.trim() ?? '';
  if (!root) {
    try {
      root = new URL(url).hostname;
    } catch {
      root = 'localhost';
    }
  }
  return root.toLowerCase().replace(/\.$/, '');
}

/** Public runtime config (inlined at build time). Never put secrets here. */
export const env = {
  /** API mock mode — the API client targets /mock-api/v1 served by Next route handlers. */
  apiMock: process.env.NEXT_PUBLIC_API_MOCK === '1',
  /** User-site origin for the "사이트 보기" link. */
  siteUrl,
  /**
   * Domain the 사무소 홈페이지 live under (`<slug>.<root>`), used to show a requested address the
   * API has no URL for yet. Same variable as the web app; defaults to the user-site hostname.
   */
  siteRootDomain: siteRootDomainOf(siteUrl, process.env.NEXT_PUBLIC_SITE_ROOT_DOMAIN),
  isProd: process.env.NODE_ENV === 'production',
} as const;
