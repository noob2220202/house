import { describe, expect, it } from 'vitest';
import { ADMIN_NAV, ADMIN_ROUTES, findAdminNav, isNavItemActive } from './nav';

const item = (href: string) => ADMIN_NAV.flatMap((g) => g.items).find((i) => i.href === href)!;

describe('admin nav · 사무소 홈페이지', () => {
  it('has its own entry with the pending-request badge', () => {
    expect(item(ADMIN_ROUTES.agencySites)).toMatchObject({
      label: '사무소 홈페이지',
      badgeKey: 'agencySitesPending',
    });
  });

  it('marks only one sidebar item active under /agencies', () => {
    const agencies = item(ADMIN_ROUTES.agencies);
    const sites = item(ADMIN_ROUTES.agencySites);
    expect(isNavItemActive('/agencies/sites', agencies)).toBe(false);
    expect(isNavItemActive('/agencies/sites', sites)).toBe(true);
    expect(isNavItemActive('/agencies/abc', agencies)).toBe(true);
    expect(isNavItemActive('/agencies/abc', sites)).toBe(false);
    expect(isNavItemActive('/agencies', agencies)).toBe(true);
  });

  it('crumbs the queue under its own item and the detail under 중개사 관리', () => {
    expect(findAdminNav('/agencies/sites')?.item.label).toBe('사무소 홈페이지');
    expect(findAdminNav('/agencies/a9000000-0000-4000-8000-000000000002')?.item.label).toBe(
      '중개사 관리',
    );
  });
});
