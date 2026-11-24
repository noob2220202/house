import { ERROR_MESSAGES, adminTotpVerifySchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import {
  mockAdminRole,
  mockCsrfOk,
  mockDelay,
  mockError,
  mockGuard,
  mockJson,
  mockUnauthenticated,
} from '@/lib/mock';
import {
  CSRF_FAIL,
  MOCK_RECOVERY_CODES,
  fullSessionValue,
  mockPending,
  mockTotpValid,
  setAdminCookie,
} from '../../_mcore';

/**
 * POST /api/v1/admin/auth/totp/verify { code }
 * - half-authenticated session → marks it MFA-verified (login complete);
 * - verified session → confirms a re-enrolled secret.
 * `recoveryCodes` are returned once, right after an enrolment.
 */
export async function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  if (!mockCsrfOk(req)) return mockError(...CSRF_FAIL);
  await mockDelay(req, 350);
  const pending = mockPending(req);
  const role = mockAdminRole(req);
  if (!pending && !role) return mockUnauthenticated();
  const parsed = adminTotpVerifySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return mockError(400, 'VALIDATION_FAILED', '인증 코드 6자리를 입력해 주세요.', [
      { path: 'code', code: 'invalid_format', message: '인증 코드 6자리를 입력해 주세요.' },
    ]);
  if (!mockTotpValid(parsed.data.code))
    return mockError(400, 'AUTH_TOTP_INVALID', ERROR_MESSAGES.AUTH_TOTP_INVALID, [
      { path: 'code', code: 'AUTH_TOTP_INVALID', message: ERROR_MESSAGES.AUTH_TOTP_INVALID },
    ]);
  if (pending) {
    const res = mockJson(
      pending.account.totpEnrolled
        ? { ok: true }
        : { ok: true, recoveryCodes: MOCK_RECOVERY_CODES },
    );
    setAdminCookie(res, fullSessionValue(pending.account.role));
    return res;
  }
  return mockJson({ ok: true, recoveryCodes: MOCK_RECOVERY_CODES });
}
