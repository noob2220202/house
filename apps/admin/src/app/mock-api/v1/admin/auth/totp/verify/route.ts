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
  fullSessionValue,
  mockAdminMe,
  mockPending,
  mockRecoveryValid,
  mockTotpValid,
  newCsrfToken,
  setAdminCookie,
  setCsrfCookie,
} from '../../_mcore';

/**
 * POST /api/v1/admin/auth/totp/verify { code } | { recoveryCode } → { admin, csrfToken }
 * (shared `AdminSessionResponse`). Second factor of an ENROLLED admin only — an admin without
 * TOTP gets 400 AUTH_TOTP_NOT_ENROLLED and must enrol (setup → activate). Rotates the session
 * into a TOTP-verified one. Wrong factor → 401 AUTH_TOTP_INVALID.
 */
export async function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  const pending = mockPending(req);
  const role = mockAdminRole(req);
  if (!pending && !role) return mockUnauthenticated();
  if (!mockCsrfOk(req)) return mockError(...CSRF_FAIL);
  await mockDelay(req, 350);
  if (pending && !pending.account.totpEnrolled)
    return mockError(400, 'AUTH_TOTP_NOT_ENROLLED', ERROR_MESSAGES.AUTH_TOTP_NOT_ENROLLED);
  const parsed = adminTotpVerifySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return mockError(400, 'VALIDATION_FAILED', '인증 코드 또는 복구 코드를 입력해 주세요.', [
      { path: 'code', code: 'invalid_format', message: '인증 코드 6자리를 입력해 주세요.' },
    ]);
  // `adminTotpVerifySchema` takes exactly one of `code` (6 digits) or `recoveryCode` (normalized).
  const { code, recoveryCode } = parsed.data;
  const valid = code !== undefined ? mockTotpValid(code) : mockRecoveryValid(recoveryCode ?? '');
  if (!valid) return mockError(401, 'AUTH_TOTP_INVALID', ERROR_MESSAGES.AUTH_TOTP_INVALID);

  const nextRole = pending ? pending.account.role : role!;
  const admin = mockAdminMe(nextRole);
  const csrfToken = newCsrfToken();
  const res = mockJson({
    admin:
      recoveryCode !== undefined
        ? { ...admin, recoveryCodesRemaining: Number(admin.recoveryCodesRemaining ?? 10) - 1 }
        : admin,
    csrfToken,
  });
  setAdminCookie(res, fullSessionValue(nextRole));
  setCsrfCookie(res, csrfToken);
  return res;
}
