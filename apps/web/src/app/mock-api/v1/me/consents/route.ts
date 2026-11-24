import { consentInputSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { authState, consentStatus } from '../../auth/_state';
import { MOCK_TERMS } from '../../terms/_fixtures';
import { meGuard, mockForcedFailure } from '../_store';

// Owned by the w-auth page group (consent history + re-consent).

// GET /api/v1/me/consents — `ConsentStatus[]`: the latest decision for every current account
// document (`{ terms, agreed, decidedAt }`).
export async function GET(req: NextRequest) {
  const g = meGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req);
  const forced = mockForcedFailure(req);
  if (forced) return forced;
  return mockJson(consentStatus(g.role));
}

// POST /api/v1/me/consents — `consentInputSchema` → `ConsentStatus[]`. Like the backend: every id
// must be a current document (AUTH_TERMS_INVALID), a required one cannot be declined
// (AUTH_REQUIRED_TERMS_REVOKE); a MARKETING decision also sets the profile's opt-in.
export async function POST(req: NextRequest) {
  const g = meGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req, 350);
  const forced = mockForcedFailure(req);
  if (forced) return forced;
  const parsed = consentInputSchema.safeParse(await req.json().catch(() => null));
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
  const byId = new Map(MOCK_TERMS.map((doc) => [doc.id, doc]));
  for (const c of parsed.data.consents) {
    const doc = byId.get(c.termsDocumentId);
    if (!doc)
      return mockError(
        400,
        'AUTH_TERMS_INVALID',
        '현재 시행 중인 약관이 아닙니다. 새로고침 후 다시 시도해 주세요.',
      );
    if (doc.isRequired && !c.agreed)
      return mockError(
        400,
        'AUTH_REQUIRED_TERMS_REVOKE',
        '필수 약관 동의는 철회할 수 없습니다. 회원 탈퇴를 이용해 주세요.',
      );
  }

  const createdAt = new Date().toISOString();
  const state = authState(g.role);
  for (const c of parsed.data.consents)
    state.consents[c.termsDocumentId] = { agreed: c.agreed, createdAt };
  const marketing = MOCK_TERMS.find((doc) => doc.type === 'MARKETING');
  const decision = parsed.data.consents.find((c) => c.termsDocumentId === marketing?.id);
  if (decision && g.state.profile.marketingOptIn !== decision.agreed) {
    g.state.profile.marketingOptIn = decision.agreed;
    g.state.profile.marketingOptInAt = decision.agreed ? createdAt : null;
  }
  return mockJson(consentStatus(g.role));
}
