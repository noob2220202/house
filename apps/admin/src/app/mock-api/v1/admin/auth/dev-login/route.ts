import { COOKIE_NAMES } from '@house/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { mockAdminSessionValue, mockGuard, type MockAdminRole } from '@/lib/mock';

/**
 * MOCK ONLY (no backend counterpart): GET /mock-api/v1/admin/auth/dev-login?as=super|admin|operator&returnTo=/
 * Signs a fake admin in and redirects, so back-office pages can be developed before the real
 * email + password + TOTP flow exists.
 */
export function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  const sp = req.nextUrl.searchParams;
  const as = sp.get('as');
  const role: MockAdminRole =
    as === 'operator' ? 'OPERATOR' : as === 'admin' ? 'ADMIN' : 'SUPER_ADMIN';
  const raw = sp.get('returnTo') ?? '/';
  const returnTo = raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') ? raw : '/';
  const res = NextResponse.redirect(new URL(returnTo, req.nextUrl.origin));
  res.cookies.set(COOKIE_NAMES.ADMIN_SESSION, mockAdminSessionValue(role), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });
  res.cookies.set(COOKIE_NAMES.CSRF, `mock-csrf-${Math.random().toString(36).slice(2)}`, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
  });
  return res;
}
