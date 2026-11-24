import { COOKIE_NAMES } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockCsrfOk, mockError, mockGuard, mockJson } from '@/lib/mock';

// POST /api/v1/admin/auth/logout — destroys the admin session cookie.
export function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  if (!mockCsrfOk(req))
    return mockError(
      403,
      'CSRF_TOKEN_INVALID',
      '보안 토큰이 올바르지 않습니다. 새로고침 후 다시 시도해 주세요.',
    );
  const res = mockJson({ ok: true });
  res.cookies.delete(COOKIE_NAMES.ADMIN_SESSION);
  return res;
}
