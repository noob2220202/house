import { ERROR_MESSAGES, adminLoginSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson } from '@/lib/mock';
import {
  CSRF_FAIL,
  MOCK_ACCOUNTS,
  MOCK_PASSWORD,
  clearPendingSetup,
  mockCsrfRequired,
  mockPendingValue,
  newCsrfToken,
  setAdminCookie,
  setCsrfCookie,
} from '../_mcore';

/**
 * POST /api/v1/admin/auth/login { email, password }
 * → 200 { mfaRequired: true, totpEnrolled, csrfToken } and a pre-MFA admin session cookie
 * (shared `AdminLoginResponse`). The session only becomes usable after the second factor:
 * POST /totp/verify (enrolled) or POST /totp/setup → /totp/activate (first enrolment).
 * Every refusal is the same 401, like the API (a locked account included).
 */
export async function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  if (mockCsrfRequired(req)) return mockError(...CSRF_FAIL);
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
  if (!account || account.locked || parsed.data.password !== MOCK_PASSWORD)
    return mockError(401, 'AUTH_INVALID_CREDENTIALS', ERROR_MESSAGES.AUTH_INVALID_CREDENTIALS);
  const csrfToken = newCsrfToken();
  const res = mockJson({ mfaRequired: true, totpEnrolled: account.totpEnrolled, csrfToken });
  setAdminCookie(res, mockPendingValue(account));
  setCsrfCookie(res, csrfToken);
  clearPendingSetup(res);
  return res;
}
