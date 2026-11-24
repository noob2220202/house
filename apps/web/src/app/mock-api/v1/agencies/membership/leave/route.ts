import { COOKIE_NAMES, ERROR_MESSAGES, ErrorCode } from '@house/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { mockDelay, mockError, mockSessionValue } from '@/lib/mock';
import { agencyContext } from '../../mine/_store';

/**
 * POST /api/v1/agencies/membership/leave — a 소속 중개사 (AGENT) leaves their office → 204. Like the
 * API, the session becomes a plain member (role USER, no acting agency); their ads move to the 대표.
 * 400 `AGENCY_OWNER_NOT_REMOVABLE` for the owner, 404 `AGENCY_MEMBER_NOT_FOUND` without a live
 * membership.
 * MOCK: the session cookie is switched to the USER fixture, so the console shows /agent/apply.
 */
export async function POST(req: NextRequest) {
  const ctx = agencyContext(req, { mutation: true });
  if (!('state' in ctx)) return ctx;
  await mockDelay(req, 400);
  if (ctx.role === 'USER' || !ctx.agency) {
    return mockError(
      404,
      ErrorCode.AGENCY_MEMBER_NOT_FOUND,
      ERROR_MESSAGES.AGENCY_MEMBER_NOT_FOUND,
    );
  }
  if (ctx.isOwner) {
    return mockError(
      400,
      ErrorCode.AGENCY_OWNER_NOT_REMOVABLE,
      ERROR_MESSAGES.AGENCY_OWNER_NOT_REMOVABLE,
    );
  }
  // The AGENT fixture is the first active 소속 중개사 (as GET /agencies/membership answers it).
  const me = ctx.state.members.find((m) => m.status === 'ACTIVE' && m.role === 'AGENT');
  if (me) {
    const now = new Date().toISOString();
    ctx.state.members = ctx.state.members.map((m) =>
      m.id === me.id ? { ...m, status: 'REMOVED' as const, removedAt: now } : m,
    );
  }
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(COOKIE_NAMES.SESSION, mockSessionValue('USER'), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });
  return res;
}
