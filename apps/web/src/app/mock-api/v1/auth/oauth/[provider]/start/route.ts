import { COOKIE_NAMES, authProviderFromSlug } from '@house/shared';
import { NextResponse, type NextRequest } from 'next/server';
import {
  mockError,
  mockGuard,
  mockSessionRole,
  mockSessionValue,
  mockUnauthenticated,
  type MockRole,
} from '@/lib/mock';
import { meState } from '../../../../me/_store';
import { seedIdentityFor } from '../../../../me/_fixtures';
import {
  issueWithdrawTicket,
  mockSignupDone,
  setMockSignupDone,
  signInAuthState,
  startPendingSignup,
} from '../../../_state';

/**
 * Origin the browser used (Host header): `next start` reports `localhost` in `nextUrl.origin` even
 * when the page was opened on 127.0.0.1, and a redirect to another host would drop the cookies just
 * set.
 */
function browserOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  return host ? `${req.nextUrl.protocol}//${host}` : req.nextUrl.origin;
}

/** Backend mapping of a provider's `error` (oauth.service.ts): cancel vs anything else. */
function backendCode(fail: string): string {
  if (/^AUTH_[A-Z_]+$/.test(fail)) return fail;
  return fail === 'access_denied' ? 'AUTH_OAUTH_CANCELLED' : 'AUTH_OAUTH_PROVIDER_ERROR';
}

/**
 * GET /api/v1/auth/oauth/{kakao|naver|google}/start?returnTo=<path>&intent=login|link
 * MOCK: there is no provider round trip — it answers at once with the redirect the backend's
 * callback would send:
 *   login, known member   session cookies → `returnTo` (default /)
 *   login, first time     pending signup cookie, no session → /signup?provider=<slug>
 *   login, suspended      withdrawal ticket, no session → /login?error=AUTH_ACCOUNT_SUSPENDED&withdrawable=1
 *   login, failure        /login?error=<AuthErrorCode>
 *   link                  needs a session; → `returnTo` (default /me/account) + `linked=<slug>`,
 *                         failure → `returnTo` + `error=<code>`
 *
 * Mock-only parameters:
 *   &as=user|agent|owner  member to sign in as (default user)
 *   &as=new               a first-time member (pending signup)
 *   &as=auto              what the login buttons send: first visit of this browser = new, then member
 *   &as=reconsent         a member who has not agreed to the current PRIVACY version yet
 *   &as=suspended         a suspended member (refused, may withdraw)
 *   &fail=CODE            a failed round trip (`access_denied` → AUTH_OAUTH_CANCELLED like the backend)
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const off = mockGuard();
  if (off) return off;
  const { provider: slug } = await ctx.params;
  const provider = authProviderFromSlug(slug);
  if (!provider) return mockError(400, 'VALIDATION_FAILED', '지원하지 않는 로그인 방식입니다.');
  const sp = req.nextUrl.searchParams;
  const raw = sp.get('returnTo');
  const returnTo =
    raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') ? raw : null;
  const origin = browserOrigin(req);
  const link = sp.get('intent') === 'link';
  const fail = sp.get('fail')?.slice(0, 60);

  if (link) {
    const current = mockSessionRole(req);
    if (!current) return mockUnauthenticated();
    const back = new URL(returnTo ?? '/me/account', origin);
    if (fail) {
      back.searchParams.set('error', backendCode(fail));
      return NextResponse.redirect(back);
    }
    const identities = meState(current).identities;
    if (!identities.some((i) => i.provider === provider))
      identities.push({ ...seedIdentityFor(provider, Date.now()), lastUsedAt: null });
    back.searchParams.set('linked', slug);
    return NextResponse.redirect(back);
  }

  if (fail) {
    const url = new URL('/login', origin);
    url.searchParams.set('error', backendCode(fail));
    return NextResponse.redirect(url);
  }

  const as = sp.get('as');
  if (as === 'suspended') {
    const url = new URL('/login', origin);
    url.searchParams.set('error', 'AUTH_ACCOUNT_SUSPENDED');
    url.searchParams.set('withdrawable', '1');
    const res = NextResponse.redirect(url);
    issueWithdrawTicket(res);
    return res;
  }
  if (as === 'new' || (as === 'auto' && !mockSignupDone(req))) {
    const res = NextResponse.redirect(new URL(`/signup?provider=${slug}`, origin));
    startPendingSignup(res, provider, returnTo);
    return res;
  }

  const role: MockRole = as === 'agent' ? 'AGENT' : as === 'owner' ? 'AGENCY_OWNER' : 'USER';
  signInAuthState(role, { reconsent: as === 'reconsent' });
  const res = NextResponse.redirect(new URL(returnTo ?? '/', origin));
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
  setMockSignupDone(res);
  return res;
}
