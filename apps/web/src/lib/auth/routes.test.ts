import { AuthProvider, COOKIE_NAMES } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE, isProtectedPath, loginUrl, oauthStartUrl, safeReturnTo } from './routes';

describe('safeReturnTo', () => {
  it('accepts site-relative paths only', () => {
    expect(safeReturnTo('/me/favorites?tab=complex')).toBe('/me/favorites?tab=complex');
    expect(safeReturnTo('https://evil.example')).toBe('/');
    expect(safeReturnTo('//evil.example')).toBe('/');
    expect(safeReturnTo('/\\evil.example')).toBe('/');
    expect(safeReturnTo('javascript:alert(1)')).toBe('/');
    expect(safeReturnTo(null)).toBe('/');
    expect(safeReturnTo('', '/me')).toBe('/me');
  });
});

describe('auth urls', () => {
  it('builds the login url with an encoded returnTo', () => {
    expect(loginUrl('/listing/abc?x=1')).toBe('/login?returnTo=%2Flisting%2Fabc%3Fx%3D1');
    expect(loginUrl()).toBe('/login');
    expect(loginUrl('https://evil.example')).toBe('/login');
  });
  it('builds the OAuth start url for the three providers', () => {
    expect(oauthStartUrl(AuthProvider.KAKAO, '/me')).toMatch(
      /\/auth\/oauth\/kakao\/start\?returnTo=%2Fme$/,
    );
    expect(oauthStartUrl(AuthProvider.NAVER)).toMatch(/\/auth\/oauth\/naver\/start\?returnTo=%2F$/);
    expect(oauthStartUrl(AuthProvider.GOOGLE, '//evil')).toMatch(
      /\/auth\/oauth\/google\/start\?returnTo=%2F$/,
    );
  });
  it('uses the same session cookie name as the backend', () => {
    expect(SESSION_COOKIE).toBe(COOKIE_NAMES.SESSION);
  });
  it('knows protected paths', () => {
    expect(isProtectedPath('/me')).toBe(true);
    expect(isProtectedPath('/me/requests')).toBe(true);
    expect(isProtectedPath('/agent/listings/new')).toBe(true);
    expect(isProtectedPath('/media')).toBe(false);
    expect(isProtectedPath('/')).toBe(false);
  });
});
