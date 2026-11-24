import type { NextRequest } from 'next/server';
import { ERROR_MESSAGES } from '@house/shared';
import { mockAdminRole, mockError, mockGuard, mockJson, mockUnauthenticated } from '@/lib/mock';
import { mockAdminMe, mockPending } from '../_mcore';

/**
 * GET /api/v1/admin/auth/me → shared `AdminMeResponse`. Like the API guard: a pre-MFA session gets
 * 401 AUTH_TOTP_REQUIRED, no session 401.
 */
export function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  if (mockPending(req))
    return mockError(401, 'AUTH_TOTP_REQUIRED', ERROR_MESSAGES.AUTH_TOTP_REQUIRED);
  const role = mockAdminRole(req);
  if (!role) return mockUnauthenticated();
  return mockJson(mockAdminMe(role));
}
