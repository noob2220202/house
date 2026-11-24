import { COOKIE_NAMES, ERROR_MESSAGES, withdrawSchema } from '@house/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { mockDelay, mockError } from '@/lib/mock';
import { MOCK_SIGNUP_COOKIE, dropAuthState } from '../../auth/_state';
import { meGuard, mockForcedFailure } from '../_store';

// Owned by the w-auth page group.
// POST /api/v1/me/withdraw — body: withdrawSchema { confirm: true, reason? } → 204. Soft delete
// (status=WITHDRAWN), all sessions destroyed (session + CSRF cookies cleared), PII scrub scheduled.
// An agency owner must hand over or close the office first (409 AUTH_WITHDRAW_AGENCY_OWNER).
export async function POST(req: NextRequest) {
  const g = meGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req, 500);
  const forced = mockForcedFailure(req);
  if (forced) return forced;
  const parsed = withdrawSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return mockError(
      400,
      'VALIDATION_FAILED',
      '입력값을 확인해 주세요.',
      parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        code: i.code,
        message: i.message,
      })),
    );
  if (g.role === 'AGENCY_OWNER')
    return mockError(409, 'AUTH_WITHDRAW_AGENCY_OWNER', ERROR_MESSAGES.AUTH_WITHDRAW_AGENCY_OWNER);
  dropAuthState(g.role);
  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete(COOKIE_NAMES.SESSION);
  res.cookies.delete(COOKIE_NAMES.CSRF);
  res.cookies.delete(MOCK_SIGNUP_COOKIE);
  return res;
}
