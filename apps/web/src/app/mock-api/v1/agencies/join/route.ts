import { COOKIE_NAMES } from '@house/shared';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { mockDelay, mockError, mockJson, mockSessionValue } from '@/lib/mock';
import { agencyContext, readJson, validationError } from '../mine/_store';

const bodySchema = z.object({
  code: z
    .string()
    .transform((s) => s.toUpperCase().replace(/[^0-9A-Z]/g, ''))
    .pipe(z.string().length(8, '초대 코드 8자리를 입력해 주세요.')),
  /** D8 개인정보 수집·이용 동의 — required; the mock does not check the version like the server. */
  consents: z
    .array(z.object({ type: z.literal('PRIVACY_AGENCY_JOIN'), version: z.string().min(1) }))
    .length(1, '개인정보 수집·이용에 동의해 주세요.'),
});

/**
 * POST /api/v1/agencies/join (ASSUMED) — a signed-in user redeems a staff invite code.
 * Body `{ code, consents }` → `{ agencyId, agencyName, role: 'AGENT' }`; the member becomes ACTIVE and the
 * user's role AGENT. MOCK: the session cookie is switched to the AGENT fixture user so the
 * console opens right away. Valid demo code: the pending invitation on /agent/staff (K7MQ-4RXD).
 */
export async function POST(req: NextRequest) {
  const ctx = agencyContext(req, { mutation: true });
  if (!('state' in ctx)) return ctx;
  await mockDelay(req, 500);
  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error.issues);
  if (ctx.role !== 'USER') {
    return mockError(409, 'AGENCY_ALREADY_MEMBER', '이미 소속된 중개사무소가 있습니다.');
  }
  const member = ctx.state.members.find(
    (m) => m.status === 'INVITED' && m.inviteCode === parsed.data.code,
  );
  if (!member) {
    return mockError(404, 'AGENCY_INVITE_INVALID', '초대 코드가 올바르지 않습니다.', [
      { path: 'code', message: '초대 코드를 다시 확인해 주세요.' },
    ]);
  }
  if (member.inviteExpiresAt && member.inviteExpiresAt < new Date().toISOString()) {
    return mockError(410, 'AGENCY_INVITE_EXPIRED', '만료된 초대 코드입니다.', [
      { path: 'code', message: '만료된 초대 코드예요. 대표님께 새 코드를 요청해 주세요.' },
    ]);
  }
  ctx.state.members = ctx.state.members.map((m) =>
    m.id === member.id
      ? {
          ...m,
          status: 'ACTIVE' as const,
          inviteCode: null,
          inviteExpiresAt: null,
          joinedAt: new Date().toISOString(),
        }
      : m,
  );
  const res = mockJson({
    agencyId: ctx.state.office.id,
    agencyName: ctx.state.office.name,
    role: 'AGENT',
  });
  res.cookies.set(COOKIE_NAMES.SESSION, mockSessionValue('AGENT'), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });
  return res;
}
