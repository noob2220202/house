import { ERROR_MESSAGES, adminPasswordChangeSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import {
  mockCsrfOk,
  mockDelay,
  mockError,
  mockGuard,
  mockJson,
  mockRequireAdmin,
} from '@/lib/mock';
import {
  CSRF_FAIL,
  MOCK_PASSWORD,
  fullSessionValue,
  mockAdminMe,
  newCsrfToken,
  setAdminCookie,
  setCsrfCookie,
} from '../_mcore';

/**
 * POST /api/v1/admin/auth/password { currentPassword, newPassword } (shared
 * `adminPasswordChangeSchema`: 12+ chars, letters + digits) → { admin, csrfToken }; the session is
 * rotated. A wrong current password → 401 AUTH_INVALID_CREDENTIALS. The mock does not store the
 * new password.
 */
export async function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  const auth = mockRequireAdmin(req);
  if (!('role' in auth)) return auth;
  if (!mockCsrfOk(req)) return mockError(...CSRF_FAIL);
  await mockDelay(req, 350);
  const parsed = adminPasswordChangeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return mockError(
      400,
      'VALIDATION_FAILED',
      '입력 내용을 확인해 주세요.',
      parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        code: i.code,
        message: i.message,
      })),
    );
  if (parsed.data.currentPassword !== MOCK_PASSWORD)
    return mockError(401, 'AUTH_INVALID_CREDENTIALS', ERROR_MESSAGES.AUTH_INVALID_CREDENTIALS);
  const csrfToken = newCsrfToken();
  const res = mockJson({ admin: mockAdminMe(auth.role), csrfToken });
  setAdminCookie(res, fullSessionValue(auth.role));
  setCsrfCookie(res, csrfToken);
  return res;
}
