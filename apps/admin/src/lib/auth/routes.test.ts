import { AdminRole, COOKIE_NAMES } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { findAdminNav, isAdminPathActive } from '@/config/nav';
import { ADMIN_SESSION_COOKIE, isPublicPath, loginUrl, safeReturnTo } from './routes';
import { hasAdminRole } from './types';

describe('admin auth helpers', () => {
  it('uses the same admin session cookie name as the backend', () => {
    expect(ADMIN_SESSION_COOKIE).toBe(COOKIE_NAMES.ADMIN_SESSION);
  });
  it('treats only /login, /healthz and the mock API as public', () => {
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/mock-api/v1/auth/csrf')).toBe(true);
    expect(isPublicPath('/')).toBe(false);
    expect(isPublicPath('/banners')).toBe(false);
  });
  it('builds safe login redirects', () => {
    expect(loginUrl('/banners?slot=MAIN')).toBe('/login?returnTo=%2Fbanners%3Fslot%3DMAIN');
    expect(loginUrl('/')).toBe('/login');
    expect(loginUrl('//evil.example')).toBe('/login');
    expect(safeReturnTo('https://evil.example')).toBe('/');
  });
  it('ranks admin roles', () => {
    expect(hasAdminRole({ role: AdminRole.SUPER_ADMIN }, AdminRole.ADMIN)).toBe(true);
    expect(hasAdminRole({ role: AdminRole.OPERATOR }, AdminRole.ADMIN)).toBe(false);
    expect(hasAdminRole({ role: AdminRole.OPERATOR })).toBe(true);
    expect(hasAdminRole(null)).toBe(false);
  });
});

describe('admin nav', () => {
  it('matches active paths', () => {
    expect(isAdminPathActive('/', '/')).toBe(true);
    expect(isAdminPathActive('/banners', '/')).toBe(false);
    expect(isAdminPathActive('/banners/123', '/banners')).toBe(true);
    expect(isAdminPathActive('/bannersx', '/banners')).toBe(false);
  });
  it('resolves crumb + title from the path', () => {
    expect(findAdminNav('/banners/popups')?.item.label).toBe('배너·팝업 관리');
    const site = findAdminNav('/settings/site');
    expect(site?.group).toBe('설정');
    expect(site?.child?.label).toBe('사이트 정보');
    expect(findAdminNav('/nope')).toBeNull();
  });
});
