import { authProviderFromSlug } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson, mockNotFound } from '@/lib/mock';
import { meGuard, mockForcedFailure } from '../../_store';

// Owned by the w-auth page group. ASSUMED endpoint (docs/frontend-integration/w-auth.md).
// DELETE /api/v1/me/identities/{kakao|naver|google} — unlink a social account.
// The last remaining login method cannot be removed (409 AUTH_IDENTITY_LAST).
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const g = meGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req, 350);
  const forced = mockForcedFailure(req);
  if (forced) return forced;
  const { provider: slug } = await ctx.params;
  const provider = authProviderFromSlug(slug.toLowerCase());
  const index = provider ? g.state.identities.findIndex((i) => i.provider === provider) : -1;
  if (index === -1) return mockNotFound('NOT_FOUND', '연결된 계정을 찾을 수 없습니다.');
  if (g.state.identities.length <= 1)
    return mockError(
      409,
      'AUTH_IDENTITY_LAST',
      '마지막 로그인 수단은 해제할 수 없습니다. 다른 계정을 먼저 연결해 주세요.',
    );
  g.state.identities.splice(index, 1);
  return mockJson({ items: g.state.identities });
}
