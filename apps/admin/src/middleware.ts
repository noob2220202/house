import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_SESSION_COOKIE, isPublicPath, loginUrl } from '@/lib/auth/routes';

/**
 * Back-office gate, first line: every page except /login needs the admin session cookie.
 * Presence check only — the console layout calls `requireAdmin()` (API-validated, TOTP verified).
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isPublicPath(pathname) || req.cookies.has(ADMIN_SESSION_COOKIE)) return NextResponse.next();
  const url = req.nextUrl.clone();
  const [path, query = ''] = loginUrl(`${pathname}${search}`).split('?');
  url.pathname = path ?? '/login';
  url.search = query ? `?${query}` : '';
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next internals, API proxies and static files.
  matcher: ['/((?!_next/|api/|mock-api/|media/|healthz|favicon.ico|.*\\.[a-z0-9]+$).*)'],
};
