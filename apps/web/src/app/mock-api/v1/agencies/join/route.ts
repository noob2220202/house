import { COOKIE_NAMES, agencyJoinSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson, mockSessionValue } from '@/lib/mock';
import { agencyContext, readJson, validationError } from '../mine/_store';

/**
 * POST /api/v1/agencies/join — a signed-in user redeems a staff invite code (`agencyJoinSchema`:
 * `{ code, displayName, title?, phone?, consents }`) → `MyAgencyMembership`. The member joins as a
 * 중개보조원 (`isLicensed: false`, a self-declared flag is stripped) and the code is used up.
 * MOCK: the session cookie is switched to the AGENT fixture user so the console opens right away.
 * Demo code: the open invitation on /agent/staff (K7MQ4-RXD2P).
 */
export async function POST(req: NextRequest) {
  const ctx = agencyContext(req, { mutation: true });
  if (!('state' in ctx)) return ctx;
  await mockDelay(req, 500);
  const parsed = agencyJoinSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error.issues);
  // D8: the server requires the current 개인정보 수집·이용 동의 (the mock does not check the version).
  if (!parsed.data.consents.some((c) => c.type === 'PRIVACY_AGENCY_JOIN')) {
    return mockError(400, 'TERMS_CONSENT_REQUIRED', '개인정보 수집·이용에 동의해 주세요.', [
      { path: 'consents', message: '개인정보 수집·이용에 동의해 주세요.' },
    ]);
  }
  if (ctx.role !== 'USER') {
    return mockError(409, 'AGENCY_ALREADY_MEMBER', '이미 소속된 중개사무소가 있습니다.');
  }
  const now = new Date().toISOString();
  const invite = ctx.state.invites.find((i) => i.code === parsed.data.code);
  if (!invite || invite.expiresAt < now) {
    return mockError(404, 'AGENCY_INVITE_INVALID', '초대 코드가 올바르지 않거나 만료되었습니다.', [
      {
        path: 'code',
        message: '초대 코드를 다시 확인해 주세요. 만료됐으면 대표님께 새 코드를 요청해 주세요.',
      },
    ]);
  }
  ctx.state.invites = ctx.state.invites.filter((i) => i.id !== invite.id);
  const member = {
    id: `mem-${invite.id.slice(0, 6)}`,
    userId: null,
    role: 'AGENT' as const,
    status: 'ACTIVE' as const,
    displayName: parsed.data.displayName,
    title: parsed.data.title ?? null,
    phone: parsed.data.phone ?? null,
    isLicensed: false,
    licenseNumber: null,
    joinedAt: now,
    removedAt: null,
  };
  ctx.state.members = [...ctx.state.members, member];
  const a = ctx.state.office;
  const res = mockJson({
    memberId: member.id,
    role: 'AGENT',
    displayName: member.displayName,
    agency: {
      id: a.id,
      name: a.name,
      phone: a.phone,
      roadAddress: a.roadAddress,
      status: a.status,
    },
  });
  res.cookies.set(COOKIE_NAMES.SESSION, mockSessionValue('AGENT'), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });
  return res;
}
