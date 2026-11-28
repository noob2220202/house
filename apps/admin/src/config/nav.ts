import { AdminRole } from '@house/shared';
import type { IconName } from '@house/ui';

/** Canonical back-office routes. Page groups link through these. */
export const ADMIN_ROUTES = {
  dashboard: '/',
  login: '/login',
  listings: '/listings',
  complexes: '/complexes',
  agencies: '/agencies',
  agencySites: '/agencies/sites',
  users: '/users',
  dealRequests: '/deal-requests',
  reports: '/reports',
  banners: '/banners',
  popups: '/banners/popups',
  content: '/content',
  notices: '/content/notices',
  faqs: '/content/faqs',
  videos: '/content/videos',
  homeEditor: '/content/home',
  stats: '/stats',
  settings: '/settings',
  siteInfo: '/settings/site',
  terms: '/settings/terms',
  socialLogin: '/settings/social-login',
  admins: '/settings/admins',
  auditLogs: '/settings/audit-logs',
} as const;

export interface AdminNavChild {
  label: string;
  href: string;
  minRole?: AdminRole;
}

export interface AdminNavItem {
  label: string;
  href: string;
  icon: IconName;
  /** Key into the sidebar badge counts (e.g. pending listings). */
  badgeKey?: AdminBadgeKey;
  /** Champagne "attention" badge instead of the cobalt one. */
  badgeWarn?: boolean;
  /** Lowest admin role that sees this item (default OPERATOR). */
  minRole?: AdminRole;
  children?: readonly AdminNavChild[];
  /** Extra path prefixes that mark the item active. */
  match?: readonly string[];
  /** Paths below `href` that belong to another item (`/agencies/sites` is not 중개사 관리). */
  exclude?: readonly string[];
}

export interface AdminNavGroup {
  /** Group heading; omit for the top (dashboard) group. */
  title?: string;
  items: readonly AdminNavItem[];
}

export type AdminBadgeKey =
  | 'listingsPending'
  | 'agenciesPending'
  | 'agencySitesPending'
  | 'dealRequestsOpen'
  | 'reportsOpen';
export type AdminBadgeCounts = Partial<Record<AdminBadgeKey, number>>;

/** Sidebar per AdminDashboard design: 대시보드 │ 매물 · 회원 │ 운영 │ 설정. */
export const ADMIN_NAV: readonly AdminNavGroup[] = [
  { items: [{ label: '대시보드', href: ADMIN_ROUTES.dashboard, icon: 'grid' }] },
  {
    title: '매물 · 회원',
    items: [
      {
        label: '매물 관리',
        href: ADMIN_ROUTES.listings,
        icon: 'building',
        badgeKey: 'listingsPending',
      },
      { label: '단지 관리', href: ADMIN_ROUTES.complexes, icon: 'layers' },
      {
        label: '중개사 관리',
        href: ADMIN_ROUTES.agencies,
        icon: 'store',
        badgeKey: 'agenciesPending',
        badgeWarn: true,
        exclude: [ADMIN_ROUTES.agencySites],
      },
      {
        label: '사무소 홈페이지',
        href: ADMIN_ROUTES.agencySites,
        icon: 'link',
        badgeKey: 'agencySitesPending',
        badgeWarn: true,
      },
      { label: '회원 관리', href: ADMIN_ROUTES.users, icon: 'users' },
    ],
  },
  {
    title: '운영',
    items: [
      {
        label: '내놓기·구하기',
        href: ADMIN_ROUTES.dealRequests,
        icon: 'home-up',
        badgeKey: 'dealRequestsOpen',
      },
      { label: '신고 관리', href: ADMIN_ROUTES.reports, icon: 'siren', badgeKey: 'reportsOpen' },
      { label: '배너·팝업 관리', href: ADMIN_ROUTES.banners, icon: 'megaphone' },
      { label: '콘텐츠(영상·소식)', href: ADMIN_ROUTES.content, icon: 'image' },
      { label: '통계', href: ADMIN_ROUTES.stats, icon: 'chart' },
    ],
  },
  {
    title: '설정',
    items: [
      {
        label: '사이트 설정',
        href: ADMIN_ROUTES.settings,
        icon: 'settings',
        minRole: AdminRole.ADMIN,
        children: [
          { label: '사이트 정보', href: ADMIN_ROUTES.siteInfo },
          { label: '약관·정책', href: ADMIN_ROUTES.terms },
          { label: '간편로그인 연동', href: ADMIN_ROUTES.socialLogin },
          { label: '관리자 계정', href: ADMIN_ROUTES.admins, minRole: AdminRole.SUPER_ADMIN },
          { label: '작업 기록', href: ADMIN_ROUTES.auditLogs },
        ],
      },
    ],
  },
];

/** True when `pathname` is the item's route or below it ("/" matches only itself). */
export function isAdminPathActive(
  pathname: string,
  href: string,
  match: readonly string[] = [],
): boolean {
  if (href === '/') return pathname === '/';
  return [href, ...match].some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

/** True when `pathname` belongs to the item (its href or `match`, minus its `exclude` paths). */
export function isNavItemActive(
  pathname: string,
  item: Pick<AdminNavItem, 'href' | 'match' | 'exclude'>,
): boolean {
  if (item.exclude?.some((x) => isAdminPathActive(pathname, x))) return false;
  return isAdminPathActive(pathname, item.href, item.match);
}

/** Finds the nav entry for a path → `{ group, item, child }` (used for the topbar crumb + title). */
export function findAdminNav(
  pathname: string,
): { group?: string; item: AdminNavItem; child?: AdminNavChild } | null {
  let best: { group?: string; item: AdminNavItem; child?: AdminNavChild; len: number } | null =
    null;
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (isNavItemActive(pathname, item) && (!best || item.href.length > best.len))
        best = { group: group.title, item, len: item.href.length };
      for (const child of item.children ?? []) {
        if (isAdminPathActive(pathname, child.href) && (!best || child.href.length >= best.len))
          best = { group: group.title, item, child, len: child.href.length };
      }
    }
  }
  return best ? { group: best.group, item: best.item, child: best.child } : null;
}
