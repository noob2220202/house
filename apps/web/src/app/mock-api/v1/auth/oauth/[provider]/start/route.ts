import { COOKIE_NAMES, authProviderFromSlug } from '@house/shared';
import { NextResponse, type NextRequest } from 'next/server';
import {
  mockError,
  mockGuard,
  mockSessionRole,
  mockSessionValue,
  mockUuid,
  mockUnauthenticated,
  type MockRole,
} from '@/lib/mock';
import { meState } from '../../../../me/_store';
import { MOCK_SIGNUP_COOKIE, resetAuthState, setMockSignup } from '../../../_state';

/**
 * GET /api/v1/auth/oauth/{kakao|naver|google}/start?returnTo=<path>
 * MOCK: there is no provider round trip — it signs a fake user in immediately and redirects to
 * `returnTo`. Pick the role with `&as=user|agent|owner` (default user), e.g.
 *   /mock-api/v1/auth/oauth/kakao/start?returnTo=/agent&as=owner
 *
 * Mock-only extras used by the w-auth flows:
 *   &as=new      a first-time user: `signupCompleted=false` until POST /me/consents
 *   &as=auto     what the login page sends: first visit of this browser = new user, afterwards = member
 *   &fail=CODE   simulate a failed round trip → redirects to /auth/callback?error=CODE
 *   &link=1      (signed in) link this provider to the current account instead of logging in
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const off = mockGuard();
  if (off) return off;
  const { provider: slug } = await ctx.params;
  const provider = authProviderFromSlug(slug);
  if (!provider) return mockError(400, 'VALIDATION_FAILED', '지원하지 않는 로그인 방식입니다.');
  const sp = req.nextUrl.searchParams;
  const raw = sp.get('returnTo') ?? '/';
  const returnTo = raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') ? raw : '/';
  const origin = req.nextUrl.origin;

  const fail = sp.get('fail');
  if (fail) {
    const url = new URL('/auth/callback', origin);
    url.searchParams.set('error', fail.slice(0, 60));
    url.searchParams.set('provider', slug);
    // A failed link round trip says so, so the landing offers 계정 설정 instead of 다시 로그인.
    if (sp.get('link') === '1') url.searchParams.set('link', '1');
    return NextResponse.redirect(url);
  }

  if (sp.get('link') === '1') {
    const current = mockSessionRole(req);
    if (!current) return mockUnauthenticated();
    const identities = meState(current).identities;
    if (!identities.some((i) => i.provider === provider)) {
      const now = new Date().toISOString();
      identities.push({
        id: mockUuid(`identity-${slug}`),
        provider,
        email: `${slug}.user@example.com`,
        lastUsedAt: null,
        createdAt: now,
      });
    }
    return NextResponse.redirect(new URL(returnTo, origin));
  }

  const as = sp.get('as');
  const role: MockRole = as === 'agent' ? 'AGENT' : as === 'owner' ? 'AGENCY_OWNER' : 'USER';
  const isNew =
    as === 'new' || (as === 'auto' && req.cookies.get(MOCK_SIGNUP_COOKIE)?.value !== 'done');
  const res = NextResponse.redirect(new URL(returnTo, origin));
  res.cookies.set(COOKIE_NAMES.SESSION, mockSessionValue(role), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
  });
  res.cookies.set(COOKIE_NAMES.CSRF, `mock-csrf-${Math.random().toString(36).slice(2)}`, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
  });
  if (isNew) {
    resetAuthState(role);
    setMockSignup(res, 'pending');
  } else {
    setMockSignup(res, 'done');
  }
  return res;
}
