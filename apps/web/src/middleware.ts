import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/config/env';
import { TO_MAIN_HEADER, officeSlugFromHost, publicHostOf } from '@/features/w-site/lib/host';
import { SESSION_COOKIE, isProtectedPath, loginUrl } from '@/lib/auth/paths';

/**
 * 1. 사무소 홈페이지 hosts (`<slug>.<root domain>`): the few office pages are rewritten to the
 *    internal `/office-site/<slug>/…` routes; everything else is sent to the main site.
 * 2. Main host: the internal `/office-site/*` routes are not reachable (404).
 * 3. Route protection, first line: redirect to /login when the session cookie is absent. This is
 *    only a cheap presence check — protected layouts/pages MUST also call `requireUser()` /
 *    `requireAgent()` from '@/lib/auth/server' (the API validates the session).
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const slug = officeSlugFromHost(publicHostOf(req.headers));
  if (slug) return officeSite(req, slug);
  if (isOfficeSitePath(pathname)) {
    // Not a page of the main site: render the regular 404 (no route answers this path).
    return NextResponse.rewrite(new URL(NOT_FOUND_PATH, req.url));
  }
  if (isProtectedPath(pathname) && !req.cookies.has(SESSION_COOKIE)) {
    return publicRedirect(req, loginUrl(`${pathname}${search}`));
  }
  return NextResponse.next();
}

/** Internal prefix of the office-site routes (app/office-site/[slug]/**). */
export const OFFICE_SITE_PREFIX = '/office-site';
/** A path no route matches → Next renders app/not-found.tsx with a 404 status. */
const NOT_FOUND_PATH = '/_not-found-office-site';

function isOfficeSitePath(pathname: string): boolean {
  return pathname === OFFICE_SITE_PREFIX || pathname.startsWith(`${OFFICE_SITE_PREFIX}/`);
}

/**
 * Served unchanged on an office host: build assets, the same-origin API / media proxies, the mock
 * API, icons and public files (pages reference them by relative URL; a redirect to the main host
 * would be blocked by the CSP).
 */
const OFFICE_PASS_THROUGH = [
  '/_next/',
  '/api/',
  '/media/',
  '/mock-api/',
  '/icons/',
  '/brand/',
  '/favicon.ico',
  '/icon.png',
  '/apple-icon.png',
  '/manifest.webmanifest',
  '/og-default.png',
] as const;

/** One `/listing/<id>` segment (ids are uuids; anything path-like is refused). */
const LISTING_PATH = /^\/listing\/([A-Za-z0-9-]{1,64})\/?$/;

/**
 * Routing of an office host: `/` → office home, `/listing/<id>` → the office variant of the
 * listing page, `/robots.txt` and `/sitemap.xml` → the office's own. Any other path is a page of
 * the main site → 307 to the same path there (sessions are host-only, so login, MY, 관심 … live
 * on the main site only).
 */
function officeSite(req: NextRequest, slug: string): NextResponse {
  const { pathname, search } = req.nextUrl;
  if (
    OFFICE_PASS_THROUGH.some((p) => (p.endsWith('/') ? pathname.startsWith(p) : pathname === p))
  ) {
    return NextResponse.next();
  }
  const base = `${OFFICE_SITE_PREFIX}/${slug}`;
  let target: string | null = null;
  if (pathname === '/') target = base;
  else if (pathname === '/robots.txt' || pathname === '/sitemap.xml') target = `${base}${pathname}`;
  else {
    const listing = LISTING_PATH.exec(pathname);
    if (listing) target = `${base}/listing/${listing[1]}`;
  }
  if (target) {
    const url = new URL(target, req.url);
    url.search = search;
    return NextResponse.rewrite(url);
  }
  const main = new URL(`${pathname}${search}`, `${env.siteUrl}/`);
  if (main.origin === req.nextUrl.origin) {
    // Dev only (main site = this server's own origin, e.g. http://localhost:3000): Next turns a
    // middleware redirect to its own origin into a relative Location, which would loop on the
    // office host. A route handler's Location is sent as is.
    const headers = new Headers(req.headers);
    headers.set(TO_MAIN_HEADER, `${pathname}${search}`);
    return NextResponse.rewrite(new URL(`${base}/to-main`, req.url), { request: { headers } });
  }
  return NextResponse.redirect(main, 307);
}

/**
 * Absolute redirect on the PUBLIC origin. Behind nginx `req.nextUrl` is the Next server's own
 * address (https://localhost:3000), and Next's middleware adapter rejects relative Locations
 * (it parses them with `new NextURL()` → 500), so the origin comes from the Host / X-Forwarded-*
 * headers nginx sets. nginx answers only our server_names (default_server returns 444), and the
 * value is still checked to be a bare host[:port] before use.
 */
export function publicRedirect(req: NextRequest, location: string): NextResponse {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto');
  const origin =
    host && /^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)
      ? `${proto === 'http' || proto === 'https' ? proto : req.nextUrl.protocol.replace(':', '')}://${host}`
      : req.nextUrl.origin;
  return NextResponse.redirect(new URL(location, origin), 307);
}

export const config = {
  // Every page: office hosts are routed by Host (see `officeSite`). Build assets and the same-origin
  // proxies never need the middleware. PROTECTED_PREFIXES (src/lib/auth/paths.ts) are covered.
  matcher: ['/((?!_next/static|_next/image|api/|media/|mock-api/|favicon.ico).*)'],
};
