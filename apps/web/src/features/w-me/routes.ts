import type { IconName } from '@house/ui';
import { ROUTES } from '@/config/nav';

/**
 * Routes of the my-page group. Paths that already exist in the global `ROUTES` are reused; the rest
 * are owned by this group (see docs/frontend-integration/w-me.md).
 */
export const ME_ROUTES = {
  overview: ROUTES.me,
  favorites: ROUTES.favorites,
  favoriteComplexes: `${ROUTES.favorites}?tab=complexes`,
  recent: '/me/recent',
  notifications: ROUTES.notifications,
  profile: '/me/profile',
  /** 내놓기·구하기 요청 관리 — built by the w-deal group. */
  requests: ROUTES.myRequests,
  /** 회원 탈퇴 flow — built by the w-auth group; this group only links to it. */
  withdraw: '/me/withdraw',
} as const;

export interface MeNavItem {
  key: 'overview' | 'favorites' | 'recent' | 'notifications' | 'requests' | 'profile';
  label: string;
  /** Longer caption used in the mobile menu list. */
  caption: string;
  href: string;
  icon: IconName;
  /** Path prefix that marks the item active (most specific wins). */
  match: string;
  /** Further prefixes that also belong to the item (pages of other groups). */
  alsoMatch?: readonly string[];
  exact?: boolean;
}

/** Side navigation (desktop) and menu list (mobile MY tab). */
export const ME_NAV: readonly MeNavItem[] = [
  {
    key: 'overview',
    label: 'MY 홈',
    caption: '내 활동을 한눈에',
    href: ME_ROUTES.overview,
    icon: 'home',
    match: '/me',
    exact: true,
  },
  {
    key: 'favorites',
    label: '관심 매물·단지',
    caption: '하트로 담아 둔 매물과 단지',
    href: ME_ROUTES.favorites,
    icon: 'heart',
    match: '/me/favorites',
  },
  {
    key: 'recent',
    label: '최근 본 매물',
    caption: '살펴본 매물을 이어서 보기',
    href: ME_ROUTES.recent,
    icon: 'eye',
    match: '/me/recent',
  },
  {
    key: 'notifications',
    label: '알림',
    caption: '제안 도착, 신고 처리 결과 등',
    href: ME_ROUTES.notifications,
    icon: 'bell',
    match: '/me/notifications',
  },
  {
    key: 'requests',
    label: '내놓기·구하기 요청',
    caption: '보낸 요청과 받은 제안',
    href: ME_ROUTES.requests,
    icon: 'home-up',
    match: '/me/requests',
  },
  {
    key: 'profile',
    label: '내 정보',
    caption: '닉네임, 연락처, 수신 동의, 연결된 계정',
    href: ME_ROUTES.profile,
    icon: 'settings',
    match: '/me/profile',
    // w-auth pages reached from 내 정보: account settings and the withdrawal flow.
    alsoMatch: ['/me/account', '/me/withdraw'],
  },
];

/** Active nav key for a pathname ("/me/favorites" → favorites, "/me" → overview). */
export function activeMeNavKey(pathname: string): MeNavItem['key'] | null {
  const under = (prefix: string) => pathname === prefix || pathname.startsWith(prefix + '/');
  const hit = ME_NAV.filter((item) =>
    item.exact ? pathname === item.match : under(item.match) || (item.alsoMatch ?? []).some(under),
  ).sort((a, b) => b.match.length - a.match.length)[0];
  return hit?.key ?? null;
}
