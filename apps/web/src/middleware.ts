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
    const url = req.nextUrl.clone();
    const [path, query = ''] = loginUrl(`${pathname}${search}`).split('?');
    url.pathname = path ?? '/login';
    url.search = query ? `?${query}` : '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Keep in sync with PROTECTED_PREFIXES in src/lib/auth/paths.ts.
  matcher: ['/me/:path*', '/agent/:path*', '/deal/sell/:path*', '/deal/find/:path*'],
};
