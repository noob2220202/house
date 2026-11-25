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
  // Relative Location: behind nginx `req.nextUrl` is the Next server's own address
  // (https://localhost:3001), so an absolute redirect built from it would leave the site.
  return new NextResponse(null, {
    status: 307,
    headers: { Location: loginUrl(`${pathname}${search}`), 'Content-Security-Policy': csp },
  });
}

export const config = {
  // Everything except Next internals, API proxies and static files.
  matcher: ['/((?!_next/|api/|mock-api/|media/|healthz|favicon.ico|.*\\.[a-z0-9]+$).*)'],
};
