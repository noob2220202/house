import { COOKIE_NAMES } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockGuard, mockJson } from '@/lib/mock';

// GET /api/v1/auth/csrf — (re)issues the readable double-submit CSRF cookie.
export function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  const token =
    req.cookies.get(COOKIE_NAMES.CSRF)?.value ?? `mock-csrf-${Math.random().toString(36).slice(2)}`;
  const res = mockJson({ csrfToken: token });
  res.cookies.set(COOKIE_NAMES.CSRF, token, { path: '/', sameSite: 'lax', httpOnly: false });
  return res;
}
