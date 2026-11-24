import { COOKIE_NAMES } from '@house/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { mockCsrfOk, mockError, mockGuard } from '@/lib/mock';

// POST /api/v1/auth/logout — 204; destroys the session and clears its cookies (session + CSRF,
// like the backend's clearCookies), so the next page knows it is signed out without asking.
export function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  if (!mockCsrfOk(req))
    return mockError(
      403,
      'CSRF_FAILED',
      '보안 토큰이 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.',
    );
  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete(COOKIE_NAMES.SESSION);
  res.cookies.delete(COOKIE_NAMES.CSRF);
  return res;
}
