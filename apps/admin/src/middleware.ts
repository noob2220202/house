import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_SESSION_COOKIE, isPublicPath, loginUrl } from '@/lib/auth/routes';
import { adminContentSecurityPolicy, createNonce, parseOrigins } from '@/lib/security/csp';

const MEDIA_HOSTS = parseOrigins(process.env.NEXT_PUBLIC_MEDIA_HOSTS);
const DEV = process.env.NODE_ENV !== 'production';

/**
 * Every page response:
 * 1. Content-Security-Policy with a per-request script nonce (`@/lib/security/csp`). The policy is
 *    also put on the request, which is where Next reads the nonce for its own scripts.
 * 2. Back-office gate, first line: every page except /login needs the admin session cookie.
 *    Presence check only — the console layout calls `requireAdmin()` (API-validated, TOTP verified).
 */
export function middleware(req: NextRequest) {
  const csp = adminContentSecurityPolicy({
    nonce: createNonce(),
    dev: DEV,
    mediaHosts: MEDIA_HOSTS,
  });
  const { pathname, search } = req.nextUrl;

  if (isPublicPath(pathname) || req.cookies.has(ADMIN_SESSION_COOKIE)) {
    const headers = new Headers(req.headers);
    headers.set('content-security-policy', csp);
    const res = NextResponse.next({ request: { headers } });
    res.headers.set('Content-Security-Policy', csp);
    return res;
  }
  const res = publicRedirect(req, loginUrl(`${pathname}${search}`));
  res.headers.set('Content-Security-Policy', csp);
  return res;
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
  // Everything except Next internals, API proxies and static files.
  matcher: ['/((?!_next/|api/|mock-api/|media/|healthz|favicon.ico|.*\\.[a-z0-9]+$).*)'],
};
