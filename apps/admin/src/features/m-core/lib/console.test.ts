import { AdminRole } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { ADMIN_ROUTES } from '@/config/nav';
import type { AdminNotification } from '../api/schemas';
import { ROLE_SUMMARY, navAccess } from './access';
import { groupNotifications, safeNotificationLink } from './notifications';
import { highlightParts, normalizeQuery } from './search';

describe('global search helpers', () => {
  it('normalises the query', () => {
    expect(normalizeQuery('  신대   레이크파크 ')).toBe('신대 레이크파크');
    expect(normalizeQuery(null)).toBe('');
    expect(normalizeQuery(undefined)).toBe('');
    expect(normalizeQuery('가'.repeat(200))).toHaveLength(80);
  });

  it('splits text around case-insensitive matches', () => {
    expect(highlightParts('신대중앙 공인중개사사무소', '신대')).toEqual([
      { text: '신대', match: true },
      { text: '중앙 공인중개사사무소', match: false },
    ]);
    expect(highlightParts('Admin admin ADMIN', 'admin')).toEqual([
      { text: 'Admin', match: true },
      { text: ' ', match: false },
      { text: 'admin', match: true },
      { text: ' ', match: false },
      { text: 'ADMIN', match: true },
    ]);
    expect(highlightParts('46150-2026-00087', '2026')).toEqual([
      { text: '46150-', match: false },
      { text: '2026', match: true },
      { text: '-00087', match: false },
    ]);
  });

  it('returns the text untouched without a match or query', () => {
    expect(highlightParts('연향동', '조례')).toEqual([{ text: '연향동', match: false }]);
    expect(highlightParts('연향동', '  ')).toEqual([{ text: '연향동', match: false }]);
    expect(highlightParts('', '연향')).toEqual([{ text: '', match: false }]);
  });

  it('treats regex characters literally', () => {
    expect(highlightParts('a.b (c)', '.')).toEqual([
      { text: 'a', match: false },
      { text: '.', match: true },
      { text: 'b (c)', match: false },
    ]);
  });
});

describe('notification helpers', () => {
  const now = '2026-11-23T05:20:00Z'; // 월 14:20 KST
  const item = (id: string, createdAt: string): AdminNotification => ({
    id,
    kind: 'SYSTEM',
    title: id,
    body: null,
    link: null,
    createdAt,
    readAt: null,
  });

  it('groups a feed by KST calendar day', () => {
    const groups = groupNotifications(
      [
        item('a', '2026-11-23T05:08:00Z'), // 12분 전
        item('b', '2026-11-22T15:10:00Z'), // 00:10 KST today
        item('c', '2026-11-22T14:50:00Z'), // 23:50 KST yesterday
        item('d', '2026-11-19T03:00:00Z'), // 4 days ago
        item('e', '2026-11-16T03:00:00Z'), // 7 days ago → older
        item('f', '2026-10-01T03:00:00Z'),
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.items.map((n) => n.id)])).toEqual([
      ['오늘', ['a', 'b']],
      ['어제', ['c']],
      ['최근 7일', ['d']],
      ['이전', ['e', 'f']],
    ]);
  });

  it('omits empty groups and keeps the feed order', () => {
    const groups = groupNotifications(
      [item('x', '2026-11-10T03:00:00Z'), item('y', '2026-11-01T03:00:00Z')],
      now,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: 'older', label: '이전' });
    expect(groups[0]!.items.map((n) => n.id)).toEqual(['x', 'y']);
    expect(groupNotifications([], now)).toEqual([]);
  });

  it('only follows site-relative links', () => {
    expect(safeNotificationLink('/agencies/123')).toBe('/agencies/123');
    expect(safeNotificationLink('/banners?slot=MAIN_HERO')).toBe('/banners?slot=MAIN_HERO');
    expect(safeNotificationLink('https://evil.example.com')).toBeNull();
    expect(safeNotificationLink('//evil.example.com')).toBeNull();
    expect(safeNotificationLink('/\\evil.example.com')).toBeNull();
    expect(safeNotificationLink('javascript:alert(1)')).toBeNull();
    // the URL parser strips tabs / newlines: "/\t/evil" would turn into "//evil"
    expect(safeNotificationLink('/\t/evil.example.com')).toBeNull();
    expect(safeNotificationLink('/\n/evil.example.com')).toBeNull();
    expect(safeNotificationLink(null)).toBeNull();
    expect(safeNotificationLink('')).toBeNull();
  });
});

describe('menu access by role', () => {
  const allowed = (role: AdminRole) =>
    navAccess(role)
      .filter((a) => a.allowed)
      .map((a) => a.href);
  const blocked = (role: AdminRole) =>
    navAccess(role)
      .filter((a) => !a.allowed)
      .map((a) => a.href);

  it('lists every sidebar destination once', () => {
    const hrefs = navAccess(AdminRole.SUPER_ADMIN).map((a) => a.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        ADMIN_ROUTES.dashboard,
        ADMIN_ROUTES.listings,
        ADMIN_ROUTES.agencies,
        ADMIN_ROUTES.banners,
        ADMIN_ROUTES.siteInfo,
        ADMIN_ROUTES.admins,
      ]),
    );
    // parents with a sub-menu are represented by their children
    expect(hrefs).not.toContain(ADMIN_ROUTES.settings);
  });

  it('gives operators the day-to-day menus only', () => {
    expect(allowed(AdminRole.OPERATOR)).toEqual(
      expect.arrayContaining([
        ADMIN_ROUTES.dashboard,
        ADMIN_ROUTES.listings,
        ADMIN_ROUTES.agencies,
        ADMIN_ROUTES.dealRequests,
        ADMIN_ROUTES.reports,
        ADMIN_ROUTES.banners,
      ]),
    );
    expect(blocked(AdminRole.OPERATOR)).toEqual(
      expect.arrayContaining([
        ADMIN_ROUTES.siteInfo,
        ADMIN_ROUTES.terms,
        ADMIN_ROUTES.socialLogin,
        ADMIN_ROUTES.admins,
        ADMIN_ROUTES.auditLogs,
      ]),
    );
  });

  it('opens site settings to admins but keeps admin accounts for the super admin', () => {
    expect(blocked(AdminRole.ADMIN)).toEqual([ADMIN_ROUTES.admins]);
    expect(blocked(AdminRole.SUPER_ADMIN)).toEqual([]);
    const admins = navAccess(AdminRole.ADMIN).find((a) => a.href === ADMIN_ROUTES.admins);
    expect(admins).toMatchObject({ minRole: AdminRole.SUPER_ADMIN, group: '사이트 설정' });
  });

  it('never makes a sub-menu more permissive than its parent', () => {
    for (const entry of navAccess(AdminRole.OPERATOR).filter((a) => a.group === '사이트 설정'))
      expect(entry.minRole).not.toBe(AdminRole.OPERATOR);
  });

  it('describes every role', () => {
    for (const role of Object.values(AdminRole)) expect(ROLE_SUMMARY[role]).toBeTruthy();
  });
});

describe('topbar search suggestions', () => {
  const routes = { listings: '/listings', agencies: '/agencies', users: '/users' };
  const source = {
    listings: {
      total: 5,
      items: [
        { id: 'l1', listingNo: '26110001', title: '신대 레이크파크 1단지 103동 34평' },
        { id: 'l2', listingNo: '26110006', title: '신대 레이크파크 3단지 301동 39평' },
        { id: 'l3', listingNo: '26110009', title: '신대 센트럴 84A' },
        { id: 'l4', listingNo: '26110010', title: '신대 센트럴 84B' },
      ],
    },
    agencies: { total: 1, items: [{ id: 'a1', name: '신대중앙 공인중개사사무소' }] },
    users: { total: 1, items: [{ id: 'u1', nickname: '신대맘' }] },
  };

  it('lists a few rows per kind and ends with the full-results row', async () => {
    const { searchSuggestions } = await import('./search');
    const rows = searchSuggestions(source, '신대', routes);
    expect(rows.map((r) => r.value)).toEqual([
      'listing:l1',
      'listing:l2',
      'listing:l3',
      'agency:a1',
      'user:u1',
      'all',
    ]);
    expect(rows[0]).toEqual({
      value: 'listing:l1',
      kind: 'listing',
      label: '신대 레이크파크 1단지 103동 34평',
      description: '매물 26110001',
      href: '/listings/l1',
    });
    expect(rows[3]).toMatchObject({ description: '중개사', href: '/agencies/a1' });
    expect(rows[4]).toMatchObject({ description: '회원', href: '/users/u1' });
    expect(rows.at(-1)).toEqual({
      value: 'all',
      kind: 'all',
      label: '‘신대’ 전체 결과 보기',
      description: '7건',
      href: '/search?q=%EC%8B%A0%EB%8C%80',
    });
  });

  it('respects the per-group limit and returns nothing without matches', async () => {
    const { searchSuggestions, searchPageHref } = await import('./search');
    expect(searchSuggestions(source, '신대', routes, 1).map((r) => r.kind)).toEqual([
      'listing',
      'agency',
      'user',
      'all',
    ]);
    const empty = { total: 0, items: [] };
    expect(
      searchSuggestions({ listings: empty, agencies: empty, users: empty }, '없음', routes),
    ).toEqual([]);
    expect(searchPageHref('a&b c')).toBe('/search?q=a%26b%20c');
  });
});
