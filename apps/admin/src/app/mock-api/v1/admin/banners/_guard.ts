import type { NextRequest } from 'next/server';
import type { z } from 'zod';
import { mockCsrfOk, mockError, mockGuard, mockRequireAdmin, type MockAdminRole } from '@/lib/mock';

const RANK: Record<MockAdminRole, number> = { OPERATOR: 1, ADMIN: 2, SUPER_ADMIN: 3 };

/**
 * Common preamble of the ads admin mocks: mock mode on, admin session, optional minimum role and
 * (for mutations) the CSRF double-submit check. Returns a Response to send, or null to continue.
 */
export function adminGuard(
  req: NextRequest,
  options: { mutation?: boolean; minRole?: MockAdminRole } = {},
): Response | null {
  const off = mockGuard();
  if (off) return off;
  const admin = mockRequireAdmin(req);
  if (admin instanceof Response) return admin;
  if (options.minRole && RANK[admin.role] < RANK[options.minRole])
    return mockError(403, 'FORBIDDEN', '접근 권한이 없습니다.');
  if (options.mutation && !mockCsrfOk(req))
    return mockError(403, 'CSRF_INVALID', '보안 토큰이 올바르지 않습니다.');
  return null;
}

/** 400 in the backend's validation shape (`details[].path` = dot path of the field). */
export function validationError(error: z.ZodError): Response {
  return mockError(
    400,
    'VALIDATION_FAILED',
    '입력값을 확인해 주세요.',
    error.issues.map((i) => ({ path: i.path.join('.'), code: i.code, message: i.message })),
  );
}

export async function readJson(req: NextRequest): Promise<unknown> {
  return req.json().catch(() => null);
}
