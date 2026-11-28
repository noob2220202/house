import { siteSlugFromHost } from '@house/shared';
import { env } from '@/config/env';

/**
 * Host helpers of the 사무소 홈페이지 (`<slug>.<root domain>`). Edge-safe (the middleware imports
 * them): no Node APIs, only the shared slug rules.
 */

/**
 * Request header the middleware hands app/office-site/[slug]/to-main: the path to send the visitor
 * to on the main site (dev only, see the middleware's `officeSite`).
 */
export const TO_MAIN_HEADER = 'x-house-to-main';

/** A bare `host[:port]` as nginx forwards it; anything else (paths, userinfo, spaces) is refused. */
const HOST_PATTERN = /^[a-z0-9.-]+(:\d{1,5})?$/i;

/**
 * The public host of a request: the first `X-Forwarded-Host` value (nginx), else `Host`; null when
 * missing or not a bare host[:port].
 */
export function publicHostOf(headers: Pick<Headers, 'get'>): string | null {
  const raw = (headers.get('x-forwarded-host') ?? headers.get('host') ?? '').split(',')[0]?.trim();
  return raw && HOST_PATTERN.test(raw) ? raw : null;
}

/**
 * Office slug addressed by `host`, or null for the main site: exactly one label under the root
 * domain that passes the slug rules (reserved labels such as `www` / `admin` / `api` → main site).
 */
export function officeSlugFromHost(
  host: string | null | undefined,
  rootDomain: string = env.siteRootDomain,
): string | null {
  if (!host || !rootDomain || !HOST_PATTERN.test(host)) return null;
  return siteSlugFromHost(host, rootDomain);
}

/** Browser only: this page is served on an office's own host (false during SSR). */
export function isOfficeSiteHost(): boolean {
  return typeof window !== 'undefined' && officeSlugFromHost(window.location.host) !== null;
}

/** Absolute URL of a path on the main site ("/listing/1" → "https://suncheonmap.kr/listing/1"). */
export function mainSiteUrl(path = '/'): string {
  return `${env.siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
