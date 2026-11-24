import { ERROR_MESSAGES, adminTotpSetupSchema } from '@house/shared';
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
  MOCK_PASSWORD,
  MOCK_SETUP_TTL_SECONDS,
  MOCK_TOTP_SECRET,
  markSetupPending,
  mockActorEmail,
  mockOtpauthUrl,
  mockPending,
  mockRecoveryValid,
  mockTotpValid,
} from '../../_mcore';

/**
 * POST /api/v1/admin/auth/totp/setup → { secret, otpauthUrl, expiresInSeconds }
 * (shared `AdminTotpSetupResponse`). Like the API:
 * - first enrolment: pre-MFA session of an admin without TOTP, empty body;
 * - pre-MFA session of an enrolled admin → 401 AUTH_TOTP_REQUIRED (verify first);
 * - rotation from a verified session: `{ currentPassword, code | recoveryCode }`, otherwise
 *   403 AUTH_REAUTH_REQUIRED; a wrong password → 401 AUTH_INVALID_CREDENTIALS, a wrong factor →
 *   401 AUTH_TOTP_INVALID.
 * The pending secret only takes effect after POST /totp/activate (10 minutes).
 */
export async function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  const pending = mockPending(req);
  const role = mockAdminRole(req);
  if (!pending && !role) return mockUnauthenticated();
  if (!mockCsrfOk(req)) return mockError(...CSRF_FAIL);
  await mockDelay(req, 250);
  if (pending?.account.totpEnrolled)
    return mockError(401, 'AUTH_TOTP_REQUIRED', ERROR_MESSAGES.AUTH_TOTP_REQUIRED);

  if (role) {
    const parsed = adminTotpSetupSchema.safeParse(await req.json().catch(() => undefined));
    if (!parsed.success)
      return mockError(400, 'VALIDATION_FAILED', '입력 내용을 확인해 주세요.', [
        ...parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          code: i.code,
          message: i.message,
        })),
      ]);
    const { currentPassword, code, recoveryCode } = parsed.data;
    if (currentPassword === undefined || (code ?? recoveryCode) === undefined)
      return mockError(403, 'AUTH_REAUTH_REQUIRED', ERROR_MESSAGES.AUTH_REAUTH_REQUIRED);
    if (currentPassword !== MOCK_PASSWORD)
      return mockError(401, 'AUTH_INVALID_CREDENTIALS', ERROR_MESSAGES.AUTH_INVALID_CREDENTIALS);
    const factorOk =
      code !== undefined ? mockTotpValid(code) : mockRecoveryValid(recoveryCode ?? '');
    if (!factorOk) return mockError(401, 'AUTH_TOTP_INVALID', ERROR_MESSAGES.AUTH_TOTP_INVALID);
  }

  const email = mockActorEmail(req);
  if (!email) return mockUnauthenticated();
  const res = mockJson({
    secret: MOCK_TOTP_SECRET,
    otpauthUrl: mockOtpauthUrl(email),
    expiresInSeconds: MOCK_SETUP_TTL_SECONDS,
  });
  markSetupPending(res);
  return res;
}
