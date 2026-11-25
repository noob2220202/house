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
    return redirectRelative(loginUrl(`${pathname}${search}`));
  }
  return NextResponse.next();
}

/**
 * 307 with a RELATIVE Location. Behind nginx, `req.nextUrl` carries the Next server's own address
 * (https://localhost:3000), so an absolute redirect built from it sends visitors to localhost.
 * A relative Location keeps the browser on whatever host it used, without trusting any header.
 */
export function redirectRelative(location: string): NextResponse {
  return new NextResponse(null, { status: 307, headers: { Location: location } });
}

export const config = {
  // Keep in sync with PROTECTED_PREFIXES in src/lib/auth/paths.ts.
  matcher: ['/me/:path*', '/agent/:path*', '/deal/sell/:path*', '/deal/find/:path*'],
};
