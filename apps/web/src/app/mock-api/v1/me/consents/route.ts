import { consentInputSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson, type MockRole } from '@/lib/mock';
import { authState, memberAuthState, mockSignupPending, setMockSignup } from '../../auth/_state';
import { MOCK_TERMS } from '../../terms/_fixtures';
import { meGuard, mockForcedFailure } from '../_store';

// Owned by the w-auth page group (signup completion + consent history).

function latest(role: MockRole, pending = false) {
  const state = pending ? authState(role) : memberAuthState(role);
  return MOCK_TERMS.flatMap((doc) => {
    const record = state.consents[doc.id];
    return record
      ? [
          {
            termsDocumentId: doc.id,
            type: doc.type,
            version: doc.version,
            title: doc.title,
            isRequired: doc.isRequired,
            agreed: record.agreed,
            createdAt: record.createdAt,
          },
        ]
      : [];
  });
}

// GET /api/v1/me/consents — latest agree/revoke record per current terms document.
export async function GET(req: NextRequest) {
  const g = meGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req);
  const forced = mockForcedFailure(req);
  if (forced) return forced;
  return mockJson({ items: mockSignupPending(req) ? [] : latest(g.role) });
}

// POST /api/v1/me/consents — body: consentInputSchema. Required documents must be agreed
// (AUTH_TERMS_REQUIRED otherwise). Completes the signup when every required document is agreed.
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
  const byId = new Map(parsed.data.consents.map((c) => [c.termsDocumentId, c.agreed]));
  if ([...byId.keys()].some((id) => !MOCK_TERMS.some((doc) => doc.id === id)))
    return mockError(404, 'NOT_FOUND', '약관을 찾을 수 없습니다.');
  const state = authState(g.role);
  const agreedAfter = (id: string) => byId.get(id) ?? state.consents[id]?.agreed ?? false;
  if (MOCK_TERMS.some((doc) => doc.isRequired && !agreedAfter(doc.id)))
    return mockError(400, 'AUTH_TERMS_REQUIRED', '필수 약관에 동의해 주세요.');

  const createdAt = new Date().toISOString();
  for (const [id, agreed] of byId) state.consents[id] = { agreed, createdAt };
  const marketing = MOCK_TERMS.find((doc) => doc.type === 'MARKETING');
  if (marketing && byId.has(marketing.id)) {
    const optIn = byId.get(marketing.id) === true;
    if (g.state.profile.marketingOptIn !== optIn) {
      g.state.profile.marketingOptIn = optIn;
      g.state.profile.marketingOptInAt = createdAt;
    }
  }
  const res = mockJson({ items: latest(g.role, true) }, { status: 201 });
  setMockSignup(res, 'done');
  return res;
}
