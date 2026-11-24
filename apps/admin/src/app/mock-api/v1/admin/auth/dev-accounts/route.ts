import { mockGuard, mockJson } from '@/lib/mock';
import { MOCK_ACCOUNTS, MOCK_PASSWORD, MOCK_TOTP_CODE } from '../_mcore';

/**
 * MOCK ONLY (no backend counterpart): GET /mock-api/v1/admin/auth/dev-accounts
 * Lists the fictional test accounts of the mock login so the login page's dev helper can offer
 * them. 404 unless mock mode is on.
 */
export function GET() {
  const off = mockGuard();
  if (off) return off;
  return mockJson({
    password: MOCK_PASSWORD,
    totpCode: MOCK_TOTP_CODE,
    accounts: MOCK_ACCOUNTS.map((a) => ({
      email: a.email,
      role: a.role,
      totpEnrolled: a.totpEnrolled,
      locked: !!a.locked,
    })),
  });
}
