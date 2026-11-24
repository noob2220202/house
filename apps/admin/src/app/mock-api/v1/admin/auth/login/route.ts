import { ERROR_MESSAGES, adminLoginSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockCsrfOk, mockDelay, mockError, mockGuard, mockJson } from '@/lib/mock';
import {
  CSRF_FAIL,
  MOCK_ACCOUNTS,
  MOCK_PASSWORD,
  mockPendingValue,
  setAdminCookie,
} from '../_mcore';

/**
 * POST /api/v1/admin/auth/login { email, password }
 * → 200 { mfaVerified: false, totpEnrolled } and a half-authenticated admin session cookie.
 * The session only becomes usable after POST /admin/auth/totp/verify.
 */
export async function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  if (!mockCsrfOk(req)) return mockError(...CSRF_FAIL);
  await mockDelay(req, 350);
  const parsed = adminLoginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return mockError(
      400,
      'VALIDATION_FAILED',
      '입력 내용을 확인해 주세요.',
      parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        code: i.code,
        message: i.path[0] === 'email' ? '이메일 형식이 올바르지 않습니다.' : '필수 항목입니다.',
      })),
    );
  const email = parsed.data.email.trim().toLowerCase();
  const account = MOCK_ACCOUNTS.find((a) => a.email === email);
  if (account?.locked)
    return mockError(423, 'AUTH_ACCOUNT_LOCKED', ERROR_MESSAGES.AUTH_ACCOUNT_LOCKED);
  if (!account || parsed.data.password !== MOCK_PASSWORD)
    return mockError(401, 'AUTH_INVALID_CREDENTIALS', ERROR_MESSAGES.AUTH_INVALID_CREDENTIALS);
  const res = mockJson({ mfaVerified: false, totpEnrolled: account.totpEnrolled });
  setAdminCookie(res, mockPendingValue(account));
  return res;
}
