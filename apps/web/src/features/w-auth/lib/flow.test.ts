import { AuthProvider, UserRole } from '@house/shared';
import { describe, expect, it } from 'vitest';
import {
  buildCallbackPath,
  loginPath,
  oauthLinkUrl,
  oauthLoginUrl,
  parseIntent,
  parseProvider,
  resolveCallbackTarget,
  resolvePostLoginTarget,
  safeNext,
  signupPath,
} from './flow';

const user = { role: UserRole.USER, signupCompleted: true };
const agent = { role: UserRole.AGENT, signupCompleted: true };

describe('parseIntent / parseProvider', () => {
  it('reads the member type from the query', () => {
    expect(parseIntent('agent')).toBe('agent');
    expect(parseIntent(['agent', 'user'])).toBe('agent');
    expect(parseIntent(undefined)).toBe('user');
    expect(parseIntent('nonsense')).toBe('user');
  });
  it('infers 중개사 from a broker-console return target', () => {
    expect(parseIntent(undefined, '/agent/apply')).toBe('agent');
    expect(parseIntent(undefined, '/agent')).toBe('agent');
    expect(parseIntent(undefined, '/agencies')).toBe('user');
    expect(parseIntent('user', '/agent/listings')).toBe('user');
  });
  it('accepts only 카카오 / 네이버 / Google', () => {
    expect(parseProvider('kakao')).toBe(AuthProvider.KAKAO);
    expect(parseProvider('NAVER')).toBe(AuthProvider.NAVER);
    expect(parseProvider('google')).toBe(AuthProvider.GOOGLE);
    expect(parseProvider('apple')).toBeUndefined();
    expect(parseProvider(undefined)).toBeUndefined();
  });
});

describe('safeNext', () => {
  it('keeps site-relative targets', () => {
    expect(safeNext('/listing/abc?tab=1')).toBe('/listing/abc?tab=1');
  });
  it('rejects open redirects', () => {
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('javascript:alert(1)')).toBe('/');
  });
  it('resolves dot segments before deciding (no "//host" after normalization)', () => {
    expect(safeNext('/..//evil.example')).toBe('/');
    expect(safeNext('/%2e%2e//evil.example')).toBe('/');
    expect(safeNext('/a/../me/favorites?x=1#top')).toBe('/me/favorites?x=1#top');
  });
  it('never returns to an auth page', () => {
    expect(safeNext('/login?returnTo=%2Fme')).toBe('/');
    expect(safeNext('/signup')).toBe('/');
    expect(safeNext('/auth/callback?next=%2Fme')).toBe('/');
    expect(safeNext('/me/../login')).toBe('/');
    expect(safeNext('/authors')).toBe('/authors');
    expect(safeNext('/login', '')).toBe('');
  });
});

describe('callback / login / signup paths', () => {
  it('carries the destination, provider and intent through the landing page', () => {
    expect(buildCallbackPath({})).toBe('/auth/callback');
    expect(buildCallbackPath({ returnTo: '/me/favorites', provider: AuthProvider.KAKAO })).toBe(
      '/auth/callback?next=%2Fme%2Ffavorites&provider=kakao',
    );
    expect(buildCallbackPath({ intent: 'agent', provider: AuthProvider.NAVER })).toBe(
      '/auth/callback?provider=naver&intent=agent',
    );
    expect(buildCallbackPath({ returnTo: 'https://evil.example' })).toBe('/auth/callback');
  });
  it('drops an over-long destination instead of exceeding the backend limit', () => {
    const long = `/search?q=${'가'.repeat(120)}`;
    const path = buildCallbackPath({ returnTo: long, provider: AuthProvider.GOOGLE });
    expect(path.length).toBeLessThanOrEqual(500);
    expect(path).toBe('/auth/callback?provider=google');
  });
  it('starts OAuth with the landing page as returnTo', () => {
    const url = oauthLoginUrl(AuthProvider.KAKAO, { returnTo: '/me' });
    expect(url).toMatch(/\/auth\/oauth\/kakao\/start\?returnTo=/);
    expect(decodeURIComponent(url.split('returnTo=')[1]!)).toBe(
      '/auth/callback?next=%2Fme&provider=kakao',
    );
  });
  it('builds the link url back to the account settings', () => {
    const url = oauthLinkUrl(AuthProvider.GOOGLE);
    expect(url).toMatch(/\/auth\/oauth\/google\/start\?returnTo=.*&link=1$/);
    expect(decodeURIComponent(url)).toContain('/me/account?linked=google');
  });
  it('builds login and signup urls', () => {
    expect(loginPath()).toBe('/login');
    expect(loginPath({ returnTo: '/me', intent: 'agent' })).toBe('/login?returnTo=%2Fme&as=agent');
    expect(signupPath({ returnTo: '/me', provider: AuthProvider.KAKAO })).toBe(
      '/signup?returnTo=%2Fme&provider=kakao',
    );
    expect(signupPath({ intent: 'agent' })).toBe('/signup?intent=agent');
  });
});

describe('post-login routing', () => {
  it('sends 일반 회원 back to where they came from', () => {
    expect(resolvePostLoginTarget({ next: '/listing/1', user })).toBe('/listing/1');
    expect(resolvePostLoginTarget({ user })).toBe('/');
  });
  it('sends a 중개사 회원 without an agency to the application', () => {
    expect(resolvePostLoginTarget({ intent: 'agent', user })).toBe('/agent/apply');
    expect(resolvePostLoginTarget({ intent: 'agent', next: '/agent/listings', user })).toBe(
      '/agent/apply',
    );
  });
  it('sends an existing agent to the console or the requested page', () => {
    expect(resolvePostLoginTarget({ intent: 'agent', user: agent })).toBe('/agent');
    expect(resolvePostLoginTarget({ intent: 'agent', next: '/agent/listings', user: agent })).toBe(
      '/agent/listings',
    );
  });
  it('routes unfinished signups to /signup first, keeping the context', () => {
    expect(
      resolveCallbackTarget({
        next: '/me',
        intent: 'agent',
        provider: AuthProvider.NAVER,
        user: { role: UserRole.USER, signupCompleted: false },
      }),
    ).toBe('/signup?returnTo=%2Fme&provider=naver&intent=agent');
    expect(resolveCallbackTarget({ next: '/me', user })).toBe('/me');
    // `signupCompleted` missing (older backend) = treated as complete.
    expect(resolveCallbackTarget({ next: '/me', user: { role: UserRole.USER } })).toBe('/me');
  });
});
