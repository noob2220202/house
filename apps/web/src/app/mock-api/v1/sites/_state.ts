import {
  AgencySiteStatus,
  DEFAULT_AGENCY_SITE_COLOR,
  siteUrl,
  type AgencySiteColor,
  type AgencySiteView,
  type MyAgencySiteResponse,
} from '@house/shared';
import { env } from '@/config/env';
import { mockUuid } from '@/lib/mock';

/**
 * In-memory 사무소 홈페이지 state of the mocks (on `globalThis`: Next compiles every route handler
 * into its own module graph; it resets when the dev server restarts). One row per office of the
 * public agencies mock (keys B01…), so the console (`/agencies/mine/site`, office B01 of the mock
 * AGENT / AGENCY_OWNER sessions), the public `/sites/:slug` and `AgencyProfile.site` agree.
 *
 * Deliberately free of imports from `agencies/_fixtures.ts` (which reads `liveSiteUrlOf` from
 * here) to keep the module graph acyclic.
 */

export interface MockSiteRow {
  officeKey: string;
  status: AgencySiteStatus;
  slug: string | null;
  requestedSlug: string | null;
  color: AgencySiteColor;
  tagline: string | null;
  requestedAt: string;
  decidedAt: string | null;
  decisionReason: string | null;
  /** deploy/sites.sh has issued the certificate (false = "주소 준비 중"). */
  httpsReady: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MockSitesState {
  rows: MockSiteRow[];
  /** FEATURES.siteSubscriptionRequired (default off: free for now). */
  subscriptionRequired: boolean;
  /** The mock office (B01) has an ACTIVE SITE subscription today. */
  subscriptionActive: boolean;
  subscriptionEndsOn: string | null;
}

/** Office of the mock console sessions (AGENT / AGENCY_OWNER). */
export const MOCK_OWNER_OFFICE = 'B01';

const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

export const SUSPEND_REASON_SAMPLE =
  '홈페이지에 다른 사무소의 매물 사진이 올라와 있다는 신고가 확인되어 운영을 잠시 멈췄어요. 사진을 정리한 뒤 고객센터로 알려 주세요.';
export const REJECT_REASON_SAMPLE =
  '사무소 상호와 관련 없는 주소예요. 상호나 지역을 알 수 있는 주소로 다시 신청해 주세요.';

function row(officeKey: string, patch: Partial<MockSiteRow>): MockSiteRow {
  const at = ago(30 * DAY);
  return {
    officeKey,
    status: AgencySiteStatus.ACTIVE,
    slug: null,
    requestedSlug: null,
    color: DEFAULT_AGENCY_SITE_COLOR,
    tagline: null,
    requestedAt: at,
    decidedAt: null,
    decisionReason: null,
    httpsReady: true,
    createdAt: at,
    updatedAt: at,
    ...patch,
  };
}

/** Fixture sites: `sindae` (B01, the console's office) and `hosu` (B02) are live. */
export function seedSiteRows(): MockSiteRow[] {
  return [
    row('B01', {
      slug: 'sindae',
      requestedSlug: 'sindae',
      color: 'GREEN',
      tagline: '신대 레이크파크만 10년, 동·호수별 일조와 조망까지 알려 드려요',
      decidedAt: ago(28 * DAY),
    }),
    row('B02', {
      slug: 'hosu',
      requestedSlug: 'hosu',
      color: 'NAVY',
      tagline: '조례 호수공원 앞, 실거주 상담부터 계약까지',
      decidedAt: ago(20 * DAY),
    }),
    row('B03', {
      status: AgencySiteStatus.REQUESTED,
      requestedSlug: 'yeonhyang-central',
      requestedAt: ago(2 * 60 * 60 * 1000),
    }),
    row('B05', {
      status: AgencySiteStatus.SUSPENDED,
      slug: 'seonwol',
      requestedSlug: 'seonwol',
      color: 'ORANGE',
      decidedAt: ago(3 * DAY),
      decisionReason: SUSPEND_REASON_SAMPLE,
    }),
  ];
}

const KEY = '__houseMockSiteStore_v1';

export function siteState(): MockSitesState {
  const g = globalThis as typeof globalThis & { [KEY]?: MockSitesState };
  g[KEY] ??= {
    rows: seedSiteRows(),
    subscriptionRequired: false,
    subscriptionActive: false,
    subscriptionEndsOn: null,
  };
  return g[KEY];
}

export function resetSiteState(): MockSitesState {
  const g = globalThis as typeof globalThis & { [KEY]?: MockSitesState };
  delete g[KEY];
  return siteState();
}

/** Public agency id of a fixture office — the convention of `agencies/_fixtures.ts`. */
export const officeAgencyId = (officeKey: string) => mockUuid(`agency-${officeKey}`);

export function siteRowOf(officeKey: string): MockSiteRow | undefined {
  return siteState().rows.find((r) => r.officeKey === officeKey);
}

/** `<protocol>//<slug>.<root>[:port]` with the protocol and port of the main site (like the API). */
export function mockSiteUrl(slug: string): string {
  let protocol = 'https:';
  let port = '';
  try {
    const main = new URL(env.siteUrl);
    protocol = main.protocol;
    port = main.port;
  } catch {
    // keep https without a port
  }
  return siteUrl(slug, env.siteRootDomain || 'localhost', protocol, port);
}

/** The subscription gate of the mocks: only the console's office can hold a subscription. */
function gatePasses(r: MockSiteRow): boolean {
  const s = siteState();
  return !s.subscriptionRequired || (r.officeKey === MOCK_OWNER_OFFICE && s.subscriptionActive);
}

/** `GET /sites/:slug` answers for it: ACTIVE + subscription gate (https is not required). */
export function isServable(r: MockSiteRow): boolean {
  return r.status === AgencySiteStatus.ACTIVE && r.slug !== null && gatePasses(r);
}

export function findServableSite(slug: string): MockSiteRow | undefined {
  return siteState().rows.find((r) => r.slug === slug && isServable(r));
}

/** `AgencyProfile.site.url` — only when the site is live (servable and https ready). */
export function liveSiteUrlOf(agencyId: string): string | null {
  const r = siteState().rows.find((x) => officeAgencyId(x.officeKey) === agencyId);
  return r && r.slug && isServable(r) && r.httpsReady ? mockSiteUrl(r.slug) : null;
}

/** TAKEN: another office's approved slug or open request. */
export function slugTaken(slug: string, exceptOffice: string): boolean {
  return siteState().rows.some(
    (r) =>
      r.officeKey !== exceptOffice &&
      (r.slug === slug || (r.status === AgencySiteStatus.REQUESTED && r.requestedSlug === slug)),
  );
}

export function toSiteView(r: MockSiteRow, agencyId: string): AgencySiteView {
  const active = r.status === AgencySiteStatus.ACTIVE;
  return {
    id: mockUuid(`site-${r.officeKey}`),
    agencyId,
    status: r.status,
    slug: r.slug,
    requestedSlug: r.requestedSlug,
    color: r.color,
    tagline: r.tagline,
    url: active && r.slug ? mockSiteUrl(r.slug) : null,
    httpsReady: r.httpsReady,
    live: isServable(r) && r.httpsReady,
    requestedAt: r.requestedAt,
    decidedAt: r.decidedAt,
    decisionReason: r.decisionReason,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** `GET /agencies/mine/site` of the console's office. */
export function mineSiteResponse(agencyId: string): MyAgencySiteResponse {
  const s = siteState();
  const r = siteRowOf(MOCK_OWNER_OFFICE);
  return {
    site: r ? toSiteView(r, agencyId) : null,
    rootDomain: env.siteRootDomain || 'localhost',
    subscription: {
      required: s.subscriptionRequired,
      active: s.subscriptionActive,
      endsOn: s.subscriptionActive ? s.subscriptionEndsOn : null,
    },
  };
}

/** Writes the console office's row (null removes it: "no site yet"). */
export function saveOwnerSite(next: MockSiteRow | null): void {
  const s = siteState();
  s.rows = s.rows.filter((r) => r.officeKey !== MOCK_OWNER_OFFICE);
  if (next) s.rows.unshift({ ...next, officeKey: MOCK_OWNER_OFFICE });
}

export function newOwnerSiteRow(patch: Partial<MockSiteRow>): MockSiteRow {
  return row(MOCK_OWNER_OFFICE, patch);
}
