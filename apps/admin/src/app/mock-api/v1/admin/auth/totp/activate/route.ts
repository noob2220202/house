import { ERROR_MESSAGES, adminTotpActivateSchema } from '@house/shared';
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
  clearPendingSetup,
  fullSessionValue,
  hasPendingSetup,
  mockAdminMe,
  mockPending,
  mockTotpValid,
  newCsrfToken,
  setAdminCookie,
  setCsrfCookie,
} from '../../_mcore';

/**
 * POST /api/v1/admin/auth/totp/activate { code } → { recoveryCodes, admin, csrfToken }
 * (shared `AdminTotpActivateResponse`). Confirms the pending secret of POST /totp/setup with a
 * first code, rotates the session into a TOTP-verified one and returns the one-time recovery
 * codes (shown exactly once). No pending secret → 400 AUTH_TOTP_SETUP_EXPIRED; wrong code →
 * 401 AUTH_TOTP_INVALID.
 */
export async function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  const pending = mockPending(req);
  const role = mockAdminRole(req);
  if (!pending && !role) return mockUnauthenticated();
  if (!mockCsrfOk(req)) return mockError(...CSRF_FAIL);
  await mockDelay(req, 350);
  if (pending?.account.totpEnrolled)
    return mockError(401, 'AUTH_TOTP_REQUIRED', ERROR_MESSAGES.AUTH_TOTP_REQUIRED);
  const parsed = adminTotpActivateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return mockError(400, 'VALIDATION_FAILED', '인증 코드 6자리를 입력해 주세요.', [
      { path: 'code', code: 'invalid_format', message: '인증 코드 6자리를 입력해 주세요.' },
    ]);
  if (!hasPendingSetup(req))
    return mockError(400, 'AUTH_TOTP_SETUP_EXPIRED', ERROR_MESSAGES.AUTH_TOTP_SETUP_EXPIRED);
  if (!mockTotpValid(parsed.data.code))
    return mockError(401, 'AUTH_TOTP_INVALID', ERROR_MESSAGES.AUTH_TOTP_INVALID);

  const nextRole = pending ? pending.account.role : role!;
  const csrfToken = newCsrfToken();
  const res = mockJson({
    recoveryCodes: [...MOCK_RECOVERY_CODES],
    admin: { ...mockAdminMe(nextRole), recoveryCodesRemaining: MOCK_RECOVERY_CODES.length },
    csrfToken,
  });
  setAdminCookie(res, fullSessionValue(nextRole));
  setCsrfCookie(res, csrfToken);
  clearPendingSetup(res);
  return res;
}
