import { updateProfileSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { authState } from '../../auth/_state';
import { MOCK_TERMS } from '../../terms/_fixtures';
import { meGuard, mockForcedFailure } from '../_store';

// GET /api/v1/me/profile — profile with consent timestamp (ASSUMED endpoint, see w-me.md).
export async function GET(req: NextRequest) {
  const g = meGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req);
  const forced = mockForcedFailure(req);
  if (forced) return forced;
  return mockJson(g.state.profile);
}

const TAKEN_NICKNAMES = ['관리자', '운영자', 'admin'];

// PATCH /api/v1/me/profile — nickname, phone (plain contact field, never verified), marketingOptIn.
export async function PATCH(req: NextRequest) {
  const g = meGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req, 400);
  const parsed = updateProfileSchema.safeParse(await req.json().catch(() => null));
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
  const { nickname, phone, marketingOptIn } = parsed.data;
  if (nickname !== undefined && TAKEN_NICKNAMES.includes(nickname.toLowerCase()))
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: 'nickname', code: 'custom', message: '사용할 수 없는 닉네임입니다.' },
    ]);
  const profile = g.state.profile;
  if (nickname !== undefined) profile.nickname = nickname;
  if (phone !== undefined) profile.phone = phone;
  if (marketingOptIn !== undefined && marketingOptIn !== profile.marketingOptIn) {
    profile.marketingOptIn = marketingOptIn;
    const changedAt = new Date().toISOString();
    profile.marketingOptInAt = changedAt;
    // Keep the consent history of the w-auth mocks (GET /me/consents) in step.
    const marketing = MOCK_TERMS.find((doc) => doc.type === 'MARKETING');
    if (marketing)
      authState(g.role).consents[marketing.id] = {
        agreed: marketingOptIn,
        createdAt: changedAt,
      };
  }
  return mockJson(profile);
}
