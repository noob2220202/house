import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, isProtectedPath, loginUrl } from '@/lib/auth/paths';

/**
 * Route protection, first line: redirect to /login when the session cookie is absent.
 * This is only a cheap presence check — protected layouts/pages MUST also call
 * `requireUser()` / `requireAgent()` from '@/lib/auth/server' (the API validates the session).
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isProtectedPath(pathname) && !req.cookies.has(SESSION_COOKIE)) {
    return publicRedirect(req, loginUrl(`${pathname}${search}`));
  }
  return NextResponse.next();
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
  // Keep in sync with PROTECTED_PREFIXES in src/lib/auth/paths.ts.
  matcher: ['/me/:path*', '/agent/:path*', '/deal/sell/:path*', '/deal/find/:path*'],
};
