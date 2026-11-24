import { COOKIE_NAMES } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockGuard, mockJson, mockUnauthenticated } from '@/lib/mock';
import { mockHasAdminSession, newCsrfToken, setCsrfCookie } from '../_mcore';

/**
 * GET /api/v1/admin/auth/csrf → { csrfToken } — the token bound to the current admin session
 * (pre-MFA or verified); 401 without one. Re-sets the readable cookie like the API does.
 */
export function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  if (!mockHasAdminSession(req)) return mockUnauthenticated();
  const csrfToken = req.cookies.get(COOKIE_NAMES.CSRF)?.value || newCsrfToken();
  const res = mockJson({ csrfToken });
  setCsrfCookie(res, csrfToken);
  return res;
}
