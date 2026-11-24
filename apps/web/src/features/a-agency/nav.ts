import type { IconName } from '@house/ui';

/**
 * Canonical routes of the broker console (/agent/**). Routes of the sibling groups (a-listings,
 * a-inbox) are listed here too so the shared sidebar can link to them before they exist.
 */
export const AGENT_ROUTES = {
  dashboard: '/agent',
  apply: '/agent/apply',
  applyJoin: '/agent/apply?tab=join',
  profile: '/agent/profile',
  staff: '/agent/staff',
  listings: '/agent/listings',
  /** 실매물 확인 필요만, 확인 만료 임박순 (a-listings list params). */
  listingsVerifyDue: '/agent/listings?due=1&sort=VERIFY_DUE',
  listingNew: '/agent/listings/new',
  listingEdit: (id: string) => `/agent/listings/${encodeURIComponent(id)}/edit`,
  /** The wizard opened at its 실매물 확인 step. */
  listingVerify: (id: string) => `/agent/listings/${encodeURIComponent(id)}/edit?step=verify`,
  coBroker: '/agent/listings/co-broker',
  requests: '/agent/requests',
  request: (id: string) => `/agent/requests/${encodeURIComponent(id)}`,
  /**
   * 문의함 — hidden for launch (D5: no inquiry backend). The route redirects to the dashboard and
   * is in no menu; it stays defined so old links and notification deep links land somewhere.
   */
  inquiries: '/agent/inquiries',
  inquiry: (id: string) => `/agent/inquiries?id=${encodeURIComponent(id)}`,
  notifications: '/agent/notifications',
} as const;

/** Sidebar badge counters (from GET /agencies/mine/dashboard). */
export type AgentBadgeKey = 'newRequests' | 'verificationDue';
export type AgentBadgeCounts = Partial<Record<AgentBadgeKey, number>>;

export interface AgentNavItem {
  label: string;
  href: string;
  icon: IconName;
  /** Extra path prefixes that mark the item active (defaults to `href`). */
  match?: readonly string[];
  /** Only an exact path match marks the item active (dashboard, 매물 등록). */
  exact?: boolean;
  /** Visible to the agency owner (개업공인중개사) only. */
  ownerOnly?: boolean;
  badgeKey?: AgentBadgeKey;
  /** Champagne (attention) badge instead of the brand one. */
  badgeWarn?: boolean;
}

export interface AgentNavGroup {
  title?: string;
  items: readonly AgentNavItem[];
}

export const AGENT_NAV: readonly AgentNavGroup[] = [
  {
    items: [{ label: '대시보드', href: AGENT_ROUTES.dashboard, icon: 'grid', exact: true }],
  },
  {
    title: '매물',
    items: [
      {
        label: '매물 관리',
        href: AGENT_ROUTES.listings,
        icon: 'building',
        badgeKey: 'verificationDue',
        badgeWarn: true,
      },
      { label: '매물 등록', href: AGENT_ROUTES.listingNew, icon: 'plus', exact: true },
      { label: '공동중개 찾기', href: AGENT_ROUTES.coBroker, icon: 'link' },
    ],
  },
  {
    title: '고객',
    items: [
      {
        label: '내놓기·구하기 요청',
        href: AGENT_ROUTES.requests,
        icon: 'home-up',
        badgeKey: 'newRequests',
      },
    ],
  },
  {
    title: '사무소',
    items: [
      { label: '사무소 프로필', href: AGENT_ROUTES.profile, icon: 'store' },
      { label: '직원 관리', href: AGENT_ROUTES.staff, icon: 'users', ownerOnly: true },
      { label: '등록 정보', href: AGENT_ROUTES.apply, icon: 'shield' },
    ],
  },
];

/** Mobile bottom bar of the console: 홈 · 매물 · 요청 · 사무소 (문의함 hidden for launch, D5). */
export const AGENT_TAB_BAR: readonly AgentNavItem[] = [
  { label: '홈', href: AGENT_ROUTES.dashboard, icon: 'grid', exact: true },
  { label: '매물', href: AGENT_ROUTES.listings, icon: 'building' },
  { label: '요청', href: AGENT_ROUTES.requests, icon: 'home-up', badgeKey: 'newRequests' },
  {
    label: '사무소',
    href: AGENT_ROUTES.profile,
    icon: 'store',
    match: [AGENT_ROUTES.profile, AGENT_ROUTES.staff, AGENT_ROUTES.apply],
  },
];

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Length of the longest prefix of `item` matching `pathname` (0 = no match). */
function matchScore(pathname: string, item: AgentNavItem): number {
  if (item.exact) return pathname === item.href ? item.href.length + 1 : 0;
  return Math.max(
    0,
    ...(item.match ?? [item.href]).map((m) => (matches(pathname, m) ? m.length : 0)),
  );
}

/** The single active item among `items` — the most specific match wins (/agent/listings/new → 매물 등록). */
export function activeNavItem<T extends AgentNavItem>(
  pathname: string,
  items: readonly T[],
): T | undefined {
  let best: T | undefined;
  let bestScore = 0;
  for (const item of items) {
    const score = matchScore(pathname, item);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}

/** Console pages that are not in the sidebar but still need a topbar crumb. */
const EXTRA_CRUMBS: readonly AgentNavItem[] = [
  { label: '알림', href: AGENT_ROUTES.notifications, icon: 'bell' },
];

/** Nav entry (with its group title) for a pathname — used for the topbar crumb. */
export function findAgentNav(pathname: string): { group?: string; item: AgentNavItem } | undefined {
  const all = AGENT_NAV.flatMap((g) => g.items);
  const item = activeNavItem(pathname, [...all, ...EXTRA_CRUMBS]);
  if (!item) return undefined;
  return { group: AGENT_NAV.find((g) => g.items.includes(item))?.title, item };
}

/** Sidebar groups visible to a member (hides owner-only entries for 소속 중개사). */
export function visibleAgentNav(isOwner: boolean): AgentNavGroup[] {
  return AGENT_NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => isOwner || !i.ownerOnly),
  })).filter((g) => g.items.length > 0);
}
