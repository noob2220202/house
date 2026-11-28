import {
  AgencySiteStatus,
  AgencyStatus,
  SUBSCRIPTION_REQUIRED_FEATURE,
  SubscriptionProduct,
  siteUrl,
  subscriptionState,
  type AdminAgencySiteListItem,
  type AgencySiteColor,
  type AgencySiteView,
  type AgencySubscriptionView,
  type AgencySubscriptionsResponse,
} from '@house/shared';
import { siteRootDomainOf } from '@/config/env';
import { db as contentDb } from '@/features/m-content/mock/store';
import { ago, dateFromNow, mid, mockTable } from '@/features/m-moderation/mock/handler';
import { AGENCY_ID, agenciesDb } from '../agencies/_fixtures';

/**
 * MOCK ONLY — 사무소 홈페이지 (`agency_sites`) and office subscriptions (`agency_subscriptions`) of
 * the admin mock offices. Separate tables next to `agenciesDb()` (whose row shape other mocks
 * share), keyed by agency id. Views are built like the API builds them (`url`, `httpsReady`,
 * `live`, subscription `state` in KST days).
 */

export interface MockSiteRow {
  id: string;
  agencyId: string;
  status: AgencySiteStatus;
  slug: string | null;
  requestedSlug: string | null;
  color: AgencySiteColor;
  tagline: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decisionReason: string | null;
  /**
   * Written by deploy/sites.sh once the certificate is live. The mock simulates the timer: an
   * approval sets it a minute ahead, and the site reads as ready from then on.
   */
  httpsReadyAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MockSubscriptionRow {
  id: string;
  agencyId: string;
  product: SubscriptionProduct;
  startsOn: string;
  endsOn: string | null;
  amountWon: number | null;
  memo: string | null;
  canceledAt: string | null;
  createdByName: string | null;
  createdAt: string;
}

function site(
  n: number,
  agencyId: string,
  row: Partial<MockSiteRow> & Pick<MockSiteRow, 'status' | 'color'> & { daysAgo: number },
): MockSiteRow {
  const { daysAgo, ...rest } = row;
  const requestedAt = ago({ d: daysAgo, h: 2 });
  return {
    id: mid('a5', n),
    agencyId,
    slug: null,
    requestedSlug: null,
    tagline: null,
    decidedAt: null,
    decisionReason: null,
    httpsReadyAt: null,
    requestedAt,
    createdAt: requestedAt,
    updatedAt: rest.decidedAt ?? requestedAt,
    ...rest,
  };
}

const SITE_SEEDS = (): MockSiteRow[] => [
  site(1, AGENCY_ID.B01, {
    status: AgencySiteStatus.ACTIVE,
    slug: 'sindae',
    requestedSlug: 'sindae',
    color: 'BLUE',
    tagline: '신대지구 아파트 전문 · 20년 경력의 대표가 직접 안내해요',
    daysAgo: 40,
    decidedAt: ago({ d: 39 }),
    httpsReadyAt: ago({ d: 39 }),
  }),
  site(2, AGENCY_ID.B02, {
    status: AgencySiteStatus.REQUESTED,
    requestedSlug: 'hosupark',
    color: 'GREEN',
    tagline: '호수공원 앞 아파트·상가 매물',
    daysAgo: 3,
  }),
  site(3, AGENCY_ID.B03, {
    status: AgencySiteStatus.REQUESTED,
    requestedSlug: 'yeonhyang-central',
    color: 'NAVY',
    tagline: null,
    daysAgo: 0,
  }),
  site(4, AGENCY_ID.B04, {
    status: AgencySiteStatus.SUSPENDED,
    slug: 'ocheon-green',
    requestedSlug: 'ocheon-green',
    color: 'TEAL',
    tagline: '오천지구 신축 아파트',
    daysAgo: 90,
    decidedAt: ago({ d: 6 }),
    decisionReason: '홈페이지에 허위·과장 광고가 게시되어 있습니다.',
    httpsReadyAt: ago({ d: 88 }),
  }),
  site(5, AGENCY_ID.B05, {
    status: AgencySiteStatus.REJECTED,
    requestedSlug: 'suncheon-official',
    color: 'PURPLE',
    tagline: '분양권 전문',
    daysAgo: 12,
    decidedAt: ago({ d: 11 }),
    decisionReason: '다른 기관·브랜드로 오해할 수 있는 주소입니다.',
  }),
  site(6, AGENCY_ID.B06, {
    status: AgencySiteStatus.ACTIVE,
    slug: 'univ-gate',
    requestedSlug: 'univ-gate',
    color: 'ORANGE',
    tagline: '순천대 앞 원룸·투룸',
    daysAgo: 1,
    decidedAt: ago({ m: 4 }),
    // Approved minutes ago: the certificate is still being issued (주소 준비 중).
    httpsReadyAt: ago({ m: -6 }),
  }),
];

const SUBSCRIPTION_SEEDS = (): MockSubscriptionRow[] => [
  {
    id: mid('a4', 1),
    agencyId: AGENCY_ID.B01,
    product: SubscriptionProduct.SITE,
    startsOn: dateFromNow(-39),
    endsOn: dateFromNow(326),
    amountWon: 0,
    memo: '출시 기념 1년 무료 제공',
    canceledAt: null,
    createdByName: '한지우',
    createdAt: ago({ d: 39 }),
  },
  {
    id: mid('a4', 2),
    agencyId: AGENCY_ID.B01,
    product: SubscriptionProduct.PLATFORM,
    startsOn: dateFromNow(-400),
    endsOn: dateFromNow(-36),
    amountWon: 330_000,
    memo: '입금자명 김서진 · 계좌이체',
    canceledAt: null,
    createdByName: '정다은',
    createdAt: ago({ d: 400 }),
  },
  {
    id: mid('a4', 3),
    agencyId: AGENCY_ID.B01,
    product: SubscriptionProduct.PLATFORM,
    startsOn: dateFromNow(-35),
    endsOn: null,
    amountWon: null,
    memo: null,
    canceledAt: null,
    createdByName: '정다은',
    createdAt: ago({ d: 35 }),
  },
  {
    id: mid('a4', 4),
    agencyId: AGENCY_ID.B04,
    product: SubscriptionProduct.SITE,
    startsOn: dateFromNow(-90),
    endsOn: dateFromNow(-1),
    amountWon: 90_000,
    memo: '3개월 이용',
    canceledAt: null,
    createdByName: '한지우',
    createdAt: ago({ d: 90 }),
  },
  {
    id: mid('a4', 5),
    agencyId: AGENCY_ID.B04,
    product: SubscriptionProduct.SITE,
    startsOn: dateFromNow(5),
    endsOn: dateFromNow(95),
    amountWon: 90_000,
    memo: '연장 신청 — 정지 해제 후 적용',
    canceledAt: ago({ d: 2 }),
    createdByName: '한지우',
    createdAt: ago({ d: 3 }),
  },
];

export function sitesDb(): MockSiteRow[] {
  return mockTable('agency-sites', SITE_SEEDS);
}
export function subscriptionsDb(): MockSubscriptionRow[] {
  return mockTable('agency-subscriptions', SUBSCRIPTION_SEEDS);
}

/** Root domain / scheme / port of office sites in the mock: those of the user site (dev: localhost). */
function siteOrigin(): { root: string; protocol: string; port: string } {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
    return {
      root: siteRootDomainOf(u.href, process.env.NEXT_PUBLIC_SITE_ROOT_DOMAIN),
      protocol: u.protocol,
      port: u.port,
    };
  } catch {
    return { root: 'localhost', protocol: 'http:', port: '3000' };
  }
}

/** The FEATURES switch of the m-content mock (사이트 정보 › 기능 설정), off unless stored true. */
function siteSubscriptionRequired(): boolean {
  const value = contentDb().settings.FEATURES?.value as Record<string, unknown> | undefined;
  return value?.[SUBSCRIPTION_REQUIRED_FEATURE.SITE] === true;
}

export function toSubscriptionView(row: MockSubscriptionRow): AgencySubscriptionView {
  return { ...row, state: subscriptionState(row) };
}

export function subscriptionsResponse(agencyId: string): AgencySubscriptionsResponse {
  const items = subscriptionsDb()
    .filter((s) => s.agencyId === agencyId)
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn) || b.createdAt.localeCompare(a.createdAt))
    .map(toSubscriptionView);
  const active = (p: SubscriptionProduct) =>
    items.some((s) => s.product === p && s.state === 'ACTIVE');
  return {
    items,
    current: {
      SITE: active(SubscriptionProduct.SITE),
      PLATFORM: active(SubscriptionProduct.PLATFORM),
    },
  };
}

/** Shared `AgencySiteView` of a mock row, with `live` derived as the API derives it. */
export function toSiteView(row: MockSiteRow, now = Date.now()): AgencySiteView {
  const { root, protocol, port } = siteOrigin();
  const active = row.status === AgencySiteStatus.ACTIVE;
  const httpsReady = row.httpsReadyAt !== null && Date.parse(row.httpsReadyAt) <= now;
  const agency = agenciesDb().find((a) => a.id === row.agencyId);
  const gate = !siteSubscriptionRequired() || subscriptionsResponse(row.agencyId).current.SITE;
  return {
    id: row.id,
    agencyId: row.agencyId,
    status: row.status,
    slug: row.slug,
    requestedSlug: row.requestedSlug,
    color: row.color,
    tagline: row.tagline,
    url: active && row.slug ? siteUrl(row.slug, root, protocol, port) : null,
    httpsReady,
    live: active && agency?.status === AgencyStatus.APPROVED && httpsReady && gate,
    requestedAt: row.requestedAt,
    decidedAt: row.decidedAt,
    decisionReason: row.decisionReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toSiteListItem(row: MockSiteRow): AdminAgencySiteListItem | null {
  const agency = agenciesDb().find((a) => a.id === row.agencyId);
  if (!agency) return null;
  return {
    site: toSiteView(row),
    agency: {
      id: agency.id,
      name: agency.name,
      representativeName: agency.representativeName,
      status: agency.status,
    },
  };
}
