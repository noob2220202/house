import { COOKIE_NAMES, signupSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson, mockSessionValue } from '@/lib/mock';
import { meState } from '../../me/_store';
import { seedIdentityFor } from '../../me/_fixtures';
import { MOCK_TERMS } from '../../terms/_fixtures';
import {
  endPendingSignup,
  mockMe,
  readPendingSignup,
  resetAuthState,
  setMockSignupDone,
} from '../_state';

/** The mock signs every new member up as the USER fixture (its in-memory state is reset). */
const ROLE = 'USER';

const expired = () =>
  mockError(
    401,
    'AUTH_SIGNUP_EXPIRED',
    '가입 시간이 만료되었습니다. 소셜 로그인을 다시 진행해 주세요.',
  );

// GET /api/v1/auth/signup — `PendingSignupResponse`: provider prefill + current account terms.
// Needs the pending signup cookie the mock OAuth start set (`as=new` / first `as=auto`).
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 250);
  const pending = readPendingSignup(req);
  if (!pending) return expired();
  return mockJson({
    provider: pending.provider,
    prefill: {
      nickname: '하늘 가득',
      name: '김하늘',
      email: 'user@example.com',
      phone: null,
      profileImageUrl: null,
    },
    terms: MOCK_TERMS.map(({ content: _content, ...summary }) => summary),
  });
}

// POST /api/v1/auth/signup — `signupSchema` → `SignupResponse { user, returnTo, csrfToken }` and a
// session. Same refusals as the backend: AUTH_TERMS_INVALID (not a current document),
// AUTH_REQUIRED_TERMS_REVOKE (a required one declined), AUTH_TERMS_REQUIRED (one missing).
export async function POST(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 400);
  const pending = readPendingSignup(req);
  if (!pending) return expired();
  const parsed = signupSchema.safeParse(await req.json().catch(() => null));
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
  const { nickname, consents, marketingOptIn } = parsed.data;
  const byId = new Map(MOCK_TERMS.map((doc) => [doc.id, doc]));
  for (const c of consents) {
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
  const agreed = new Set(consents.filter((c) => c.agreed).map((c) => c.termsDocumentId));
  if (MOCK_TERMS.some((doc) => doc.isRequired && !agreed.has(doc.id)))
    return mockError(400, 'AUTH_TERMS_REQUIRED', '필수 약관에 동의해 주세요.');

  const now = new Date().toISOString();
  const state = resetAuthState(ROLE);
  const marketing = MOCK_TERMS.find((doc) => doc.type === 'MARKETING');
  const optIn = consents.find((c) => c.termsDocumentId === marketing?.id)?.agreed ?? marketingOptIn;
  for (const c of consents)
    state.consents[c.termsDocumentId] = { agreed: c.agreed, createdAt: now };
  if (marketing && !state.consents[marketing.id])
    state.consents[marketing.id] = { agreed: optIn, createdAt: now };
  const me = meState(ROLE);
  me.profile.nickname = nickname;
  me.profile.marketingOptIn = optIn;
  me.profile.marketingOptInAt = optIn ? now : null;
  me.profile.createdAt = now;
  me.identities = [seedIdentityFor(pending.provider, Date.now())];

  const csrfToken = `mock-csrf-${Math.random().toString(36).slice(2)}`;
  const res = mockJson(
    { user: mockMe(ROLE), returnTo: pending.returnTo, csrfToken },
    { status: 201 },
  );
  endPendingSignup(res, pending.id);
  res.cookies.set(COOKIE_NAMES.SESSION, mockSessionValue(ROLE), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });
  res.cookies.set(COOKIE_NAMES.CSRF, csrfToken, { path: '/', httpOnly: false, sameSite: 'lax' });
  setMockSignupDone(res);
  return res;
}
