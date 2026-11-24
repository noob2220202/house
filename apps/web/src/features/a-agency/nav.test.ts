import { describe, expect, it } from 'vitest';
import {
  AGENT_NAV,
  AGENT_ROUTES,
  AGENT_TAB_BAR,
  activeNavItem,
  findAgentNav,
  visibleAgentNav,
} from './nav';

describe('agent console nav', () => {
  it('picks the most specific item', () => {
    expect(findAgentNav('/agent')?.item.label).toBe('대시보드');
    expect(findAgentNav('/agent/listings')?.item.label).toBe('매물 관리');
    expect(findAgentNav('/agent/listings/new')?.item.label).toBe('매물 등록');
    expect(findAgentNav('/agent/listings/abc/edit')?.item.label).toBe('매물 관리');
    expect(findAgentNav('/agent/requests/req-01')).toMatchObject({
      group: '고객',
      item: { label: '내놓기·구하기 요청' },
    });
    expect(findAgentNav('/agent/apply')?.item.label).toBe('등록 정보');
    expect(findAgentNav('/agent/unknown')).toBeUndefined();
  });
  it('covers the co-broker search and the console notifications', () => {
    expect(findAgentNav('/agent/listings/co-broker')).toMatchObject({
      group: '매물',
      item: { label: '공동중개 찾기' },
    });
    expect(findAgentNav('/agent/notifications')?.item.label).toBe('알림');
    expect(AGENT_ROUTES.notifications).toBe('/agent/notifications');
    expect(AGENT_ROUTES.listingVerify('L 1')).toBe('/agent/listings/L%201/edit?step=verify');
  });
  it('does not treat the dashboard as active on sub pages', () => {
    const all = AGENT_NAV.flatMap((g) => g.items);
    expect(activeNavItem('/agent/profile', all)?.label).toBe('사무소 프로필');
  });
  it('hides owner-only entries for staff', () => {
    const labels = (owner: boolean) =>
      visibleAgentNav(owner).flatMap((g) => g.items.map((i) => i.label));
    expect(labels(true)).toContain('직원 관리');
    expect(labels(false)).not.toContain('직원 관리');
    expect(labels(false)).toContain('사무소 프로필');
  });
  it('hides the 문의함 for launch (D5) — no menu entry, no badge', () => {
    const items = [...AGENT_NAV.flatMap((g) => g.items), ...AGENT_TAB_BAR];
    expect(items.some((i) => i.href === AGENT_ROUTES.inquiries)).toBe(false);
    expect(findAgentNav('/agent/inquiries')).toBeUndefined();
    expect(AGENT_TAB_BAR.map((i) => i.label)).toEqual(['홈', '매물', '요청', '사무소']);
  });
  it('maps office pages to the 사무소 tab on mobile', () => {
    expect(activeNavItem('/agent/staff', AGENT_TAB_BAR)?.label).toBe('사무소');
    expect(activeNavItem('/agent/apply', AGENT_TAB_BAR)?.label).toBe('사무소');
    expect(activeNavItem('/agent', AGENT_TAB_BAR)?.label).toBe('홈');
  });
});
