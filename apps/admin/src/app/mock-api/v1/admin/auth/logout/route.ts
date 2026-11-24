import { COOKIE_NAMES } from '@house/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { mockCsrfOk, mockError, mockGuard, mockUnauthenticated } from '@/lib/mock';
import { CSRF_FAIL, clearPendingSetup, mockHasAdminSession } from '../_mcore';

// POST /api/v1/admin/auth/logout → 204; ends the admin session (pre-MFA or verified).
export function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  if (!mockHasAdminSession(req)) return mockUnauthenticated();
  if (!mockCsrfOk(req)) return mockError(...CSRF_FAIL);
  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete(COOKIE_NAMES.ADMIN_SESSION);
  res.cookies.delete(COOKIE_NAMES.CSRF);
  clearPendingSetup(res);
  return res;
}
