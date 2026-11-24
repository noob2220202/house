import type { IconName } from '@house/ui';

/** Canonical routes of the user site. Page groups link through these — never hard-code paths. */
export const ROUTES = {
  home: '/',
  map: (asset: MapAssetSlug = 'apt') => `/map/${asset}`,
  listing: (id: string) => `/listing/${id}`,
  complex: (id: string) => `/complex/${id}`,
  agencies: '/agencies',
  agency: (id: string) => `/agency/${id}`,
  deal: '/deal',
  dealSell: '/deal/sell',
  dealFind: '/deal/find',
  community: '/community',
  search: (q: string) => `/search?q=${encodeURIComponent(q)}`,
  login: '/login',
  signup: '/signup',
  me: '/me',
  favorites: '/me/favorites',
  myRequests: '/me/requests',
  notifications: '/me/notifications',
  agent: '/agent',
  agentApply: '/agent/apply',
  notices: '/notices',
  faq: '/faq',
  videos: '/videos',
  tools: '/tools',
  adInquiry: '/support/ads',
  support: '/support',
  report: '/support/report',
  terms: (type: 'service' | 'privacy' | 'location' | 'brokerage-fee' | 'false-listing') =>
    `/terms/${type}`,
  /** SEO / GEO pages (w-seo; landing URLs are built by `SEO_ROUTES` in lib/seo/regions). */
  regions: '/suncheon',
  about: '/about',
  tradeReport: '/reports/suncheon-apartment-trades',
} as const;

export type MapAssetSlug = 'apt' | 'oneroom' | 'house' | 'commercial' | 'land';

export interface NavItem {
  label: string;
  href: string;
  /** Path prefixes that mark this item active. */
  match: readonly string[];
}

/** GNB: 5 asset types │ 중개사무소 · 커뮤니티 (separator after index 4). */
export const PRIMARY_NAV: readonly NavItem[] = [
  { label: '아파트·분양권', href: ROUTES.map('apt'), match: ['/map/apt', '/complex'] },
  { label: '원룸·투룸', href: ROUTES.map('oneroom'), match: ['/map/oneroom'] },
  { label: '주택', href: ROUTES.map('house'), match: ['/map/house'] },
  { label: '상업·업무', href: ROUTES.map('commercial'), match: ['/map/commercial'] },
  { label: '토지', href: ROUTES.map('land'), match: ['/map/land'] },
];
export const SECONDARY_NAV: readonly NavItem[] = [
  { label: '중개사무소', href: ROUTES.agencies, match: ['/agencies', '/agency'] },
  { label: '커뮤니티', href: ROUTES.community, match: ['/community', '/videos', '/notices'] },
];

export const UTILITY_NAV: readonly { label: string; href: string }[] = [
  { label: '중개사 회원 가입', href: ROUTES.agentApply },
  { label: '광고 문의', href: ROUTES.adInquiry },
  { label: '고객센터', href: ROUTES.support },
];

export interface TabBarItem {
  label: string;
  href: string;
  icon: IconName;
  match: readonly string[];
  /** Exact match only (home). */
  exact?: boolean;
  /** Centre call-to-action tab (내놓기·구하기) drawn with a cobalt tile. */
  cta?: boolean;
}

/** Mobile bottom tab bar (MobileHome design): 홈 · 지도 · 내놓기·구하기 · 관심 · MY. */
export const TAB_BAR: readonly TabBarItem[] = [
  { label: '홈', href: ROUTES.home, icon: 'home', match: ['/'], exact: true },
  { label: '지도', href: ROUTES.map('apt'), icon: 'map-pin', match: ['/map', '/complex'] },
  { label: '내놓기·구하기', href: ROUTES.deal, icon: 'swap', match: ['/deal'], cta: true },
  { label: '관심', href: ROUTES.favorites, icon: 'heart', match: ['/me/favorites'] },
  { label: 'MY', href: ROUTES.me, icon: 'user', match: ['/me', '/login', '/signup'] },
];

export const FOOTER_COLUMNS: readonly {
  title: string;
  links: readonly { label: string; href: string }[];
}[] = [
  {
    title: '매물 찾기',
    links: [
      { label: '아파트·분양권', href: ROUTES.map('apt') },
      { label: '원룸·투룸', href: ROUTES.map('oneroom') },
      { label: '주택', href: ROUTES.map('house') },
      { label: '상업·업무', href: ROUTES.map('commercial') },
      { label: '토지', href: ROUTES.map('land') },
    ],
  },
  {
    title: '서비스',
    links: [
      { label: '내놓기 · 구하기', href: ROUTES.deal },
      { label: '중개사무소 찾기', href: ROUTES.agencies },
      { label: '순천 지역별 시세', href: ROUTES.regions },
      { label: '아파트 실거래 리포트', href: ROUTES.tradeReport },
      { label: '커뮤니티', href: ROUTES.community },
      { label: '허위매물 신고', href: ROUTES.report },
    ],
  },
  {
    title: '부동산 계산기',
    links: [
      { label: '중개보수', href: `${ROUTES.tools}#fee` },
      { label: '취득세', href: `${ROUTES.tools}#acquisition-tax` },
      { label: '양도소득세', href: `${ROUTES.tools}#transfer-tax` },
      { label: '대출 이자', href: `${ROUTES.tools}#loan` },
      { label: '평 · ㎡ 환산', href: `${ROUTES.tools}#area` },
    ],
  },
  {
    title: '고객지원',
    links: [
      { label: '서비스 소개', href: ROUTES.about },
      { label: '공지사항', href: ROUTES.notices },
      { label: '자주 묻는 질문', href: ROUTES.faq },
      { label: '광고 문의', href: ROUTES.adInquiry },
      { label: '중개사 회원 가입', href: ROUTES.agentApply },
    ],
  },
];

export const LEGAL_LINKS: readonly {
  label: string;
  href: string;
  strong?: boolean;
  mobile?: boolean;
}[] = [
  { label: '이용약관', href: ROUTES.terms('service'), mobile: true },
  { label: '개인정보처리방침', href: ROUTES.terms('privacy'), strong: true, mobile: true },
  { label: '위치기반서비스 이용약관', href: ROUTES.terms('location'), mobile: true },
  { label: '중개보수 안내', href: ROUTES.terms('brokerage-fee') },
  { label: '허위매물 신고 정책', href: ROUTES.terms('false-listing') },
];

/** True when `pathname` belongs to the nav item. */
export function isActivePath(pathname: string, match: readonly string[], exact = false): boolean {
  if (exact) return match.includes(pathname);
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}
