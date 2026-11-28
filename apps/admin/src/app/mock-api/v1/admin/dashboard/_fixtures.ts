import type {
  RemoteDealRequests,
  RemoteExpiringAd,
  RemotePendingAgency,
  RemotePendingSite,
  RemoteReports,
} from './_remote';
import { TIME, ago, mockCoreId, mockCoreState } from './_store';

export interface PendingQueue {
  total: number;
  items: RemotePendingAgency[];
}

export interface MockDashboardInput {
  /** Pending applications from the agencies mock (falls back to the local fixture). */
  pending?: PendingQueue | null;
  /** Visitor counts from the stats mock (falls back to the design's numbers). */
  visitors?: { today: number; yesterday: number } | null;
  /** Banners about to end from the ads mock (falls back to the three ads of the draft). */
  expiring?: { total: number; items: RemoteExpiringAd[] } | null;
  /** Open 내놓기·구하기 requests from the deal-requests mock (falls back to the draft's five). */
  dealRequests?: RemoteDealRequests | null;
  /** Report queue + handling stats from the reports mock (falls back to the draft's three). */
  reports?: RemoteReports | null;
  /** 사무소 홈페이지 requests from the agency-sites mock (falls back to two local requests). */
  pendingSites?: { total: number; items: RemotePendingSite[] } | null;
  now?: number;
}

function kstDate(offsetDays: number, now = Date.now()): string {
  // KST calendar date `offsetDays` before today.
  return new Date(now + 9 * TIME.HOUR - offsetDays * TIME.DAY).toISOString().slice(0, 10);
}

/** ISO moment at `time` (HH:mm, KST) on the day `offsetDays` before today — never in the future. */
function kstMoment(offsetDays: number, time: string, now = Date.now()): string {
  const at = Date.parse(`${kstDate(offsetDays, now)}T${time}:00+09:00`);
  return new Date(Math.min(at, now - TIME.MIN)).toISOString();
}

/** Local fallback for the approval queue (the four applications of the dashboard draft). */
function localPending(now: number): PendingQueue {
  const items = mockCoreState().pendingAgencies.map(({ daysAgo, ...a }) => ({
    ...a,
    appliedAt: kstMoment(daysAgo, '09:30', now),
  }));
  return { total: items.length, items };
}

/** Local fallback for the 사무소 홈페이지 queue (same offices as the agency-sites mock). */
function localPendingSites(now: number): { total: number; items: RemotePendingSite[] } {
  const items: RemotePendingSite[] = [
    {
      agencyId: 'a9000000-0000-4000-8000-000000000002',
      agencyName: '호수공원 공인중개사사무소',
      requestedSlug: 'hosupark',
      requestedAt: ago(3 * TIME.DAY, now),
    },
    {
      agencyId: 'a9000000-0000-4000-8000-000000000003',
      agencyName: '연향센트럴 공인중개사사무소',
      requestedSlug: 'yeonhyang-central',
      requestedAt: ago(2 * TIME.HOUR, now),
    },
  ];
  return { total: items.length, items };
}

const DAY_MS = TIME.DAY;
function waitingDays(appliedAt: string, now: number): number {
  const day = (t: number) => Math.floor((t + 9 * TIME.HOUR) / DAY_MS);
  return Math.max(0, day(now) - day(Date.parse(appliedAt)));
}

export function mockSummary(input: MockDashboardInput = {}) {
  const now = input.now ?? Date.now();
  const state = mockCoreState();
  const pending = input.pending ?? localPending(now);
  const pendingSites = input.pendingSites ?? localPendingSites(now);
  return {
    generatedAt: new Date(now).toISOString(),
    badges: {
      listingsPending: 12,
      agenciesPending: pending.total,
      dealRequestsOpen: input.dealRequests?.total ?? 5,
      reportsOpen: input.reports?.open ?? 3,
      agencySitesPending: pendingSites.total,
    },
    notificationsUnread: state.notifications.filter((n) => !n.read).length,
    kpis: {
      visitors: input.visitors ?? { today: 3482, yesterday: 3206 },
      newListings: { today: 47, yesterday: 35, pendingReview: 12 },
      dealRequests: input.dealRequests?.kpi ?? { today: 5, sell: 3, find: 2, unassigned: 1 },
      pendingAgencies: {
        count: pending.total,
        oldestWaitingDays: pending.items.length
          ? Math.max(...pending.items.map((a) => waitingDays(a.appliedAt, now)))
          : null,
        needsDocuments: pending.items.filter((a) => a.documents.submitted < a.documents.required)
          .length,
      },
    },
    socialLogin: [
      { provider: 'KAKAO', enabled: true, healthy: true },
      { provider: 'NAVER', enabled: true, healthy: true },
      { provider: 'GOOGLE', enabled: true, healthy: true },
    ],
  };
}

export function mockQueues(input: MockDashboardInput = {}) {
  const now = input.now ?? Date.now();
  const pending = input.pending ?? localPending(now);
  const pendingSites = input.pendingSites ?? localPendingSites(now);
  const dealRequests = [
    {
      id: mockCoreId('d1', 1),
      type: 'SELL_OR_LEASE',
      title: '신대 레이크파크 1단지 · 34평',
      dealType: 'SALE',
      price: 45000,
      note: '103동 고층',
      createdAt: ago(12 * TIME.MIN, now),
      deliveredAgencyCount: 0,
      activeProposalCount: 0,
    },
    {
      id: mockCoreId('d1', 2),
      type: 'WANTED',
      title: '신대지구 · 34평',
      dealType: 'SALE',
      price: 45000,
      note: '2027년 봄 입주',
      createdAt: ago(38 * TIME.MIN, now),
      deliveredAgencyCount: 12,
      activeProposalCount: 0,
    },
    {
      id: mockCoreId('d1', 3),
      type: 'SELL_OR_LEASE',
      title: '오천 그린빌 · 24평',
      dealType: 'JEONSE',
      price: 19000,
      note: '107동',
      createdAt: ago(1 * TIME.HOUR + 8 * TIME.MIN, now),
      deliveredAgencyCount: 9,
      activeProposalCount: 2,
    },
    {
      id: mockCoreId('d1', 4),
      type: 'WANTED',
      title: '석현동 원룸·투룸 · 월세',
      dealType: 'MONTHLY',
      deposit: 500,
      monthlyRent: 40,
      note: null,
      createdAt: ago(2 * TIME.HOUR + 20 * TIME.MIN, now),
      deliveredAgencyCount: 6,
      activeProposalCount: 0,
    },
    {
      id: mockCoreId('d1', 5),
      type: 'SELL_OR_LEASE',
      title: '왕지 숲속마을 · 25평',
      dealType: 'SALE',
      price: 24000,
      note: '104동',
      createdAt: ago(3 * TIME.HOUR + 5 * TIME.MIN, now),
      deliveredAgencyCount: 7,
      activeProposalCount: 1,
    },
  ];
  const reports = [
    {
      id: mockCoreId('e1', 1),
      targetType: 'LISTING',
      targetId: mockCoreId('f1', 3),
      reason: 'WRONG_PRICE',
      title: '연향 센트럴 32평 매매 3억 1,000',
      agencyName: '연향센트럴 공인중개사사무소',
      reportCount: 2,
      lastReportedAt: ago(40 * TIME.MIN, now),
    },
    {
      id: mockCoreId('e1', 2),
      targetType: 'LISTING',
      targetId: mockCoreId('f1', 4),
      reason: 'ALREADY_DEALT',
      title: '조례 호수마을 24평 월세 2,000/65',
      agencyName: '호수공원 공인중개사사무소',
      reportCount: 1,
      lastReportedAt: ago(2 * TIME.HOUR + 30 * TIME.MIN, now),
    },
    {
      id: mockCoreId('e1', 3),
      targetType: 'LISTING',
      targetId: mockCoreId('f1', 9),
      reason: 'WRONG_PHOTO',
      title: '석현동 해오름빌 투룸 월세 500/42',
      agencyName: '순천대정문 공인중개사사무소',
      reportCount: 1,
      lastReportedAt: kstMoment(1, '15:00', now),
    },
  ];
  const expiringAds = [
    {
      id: mockCoreId('b1', 5),
      kind: 'BANNER',
      advertiserName: '신대중앙 공인중개사사무소',
      slot: 'MAP_AD',
      placementLabel: '지도 플로팅 카드',
      endAt: new Date(now + 3 * TIME.DAY).toISOString(),
      ctr: 0.028,
      imageUrl: null,
    },
    {
      id: mockCoreId('b1', 6),
      kind: 'BANNER',
      advertiserName: '선월 분양권 공인중개사사무소',
      slot: 'MAP_AD',
      placementLabel: '지도 플로팅 카드',
      endAt: new Date(now + 5 * TIME.DAY).toISOString(),
      ctr: 0.024,
      imageUrl: null,
    },
    {
      id: mockCoreId('b1', 1),
      kind: 'BANNER',
      advertiserName: '연향들 더 퍼스트',
      slot: 'MAIN_HERO',
      placementLabel: '메인 와이드 배너 1/3',
      endAt: new Date(now + 7 * TIME.DAY).toISOString(),
      ctr: 0.023,
      imageUrl: null,
    },
  ];
  return {
    pendingAgencies: { total: pending.total, items: pending.items.slice(0, 5) },
    pendingAgencySites: { total: pendingSites.total, items: pendingSites.items.slice(0, 5) },
    dealRequests: input.dealRequests
      ? { total: input.dealRequests.total, items: input.dealRequests.items }
      : { total: dealRequests.length, items: dealRequests },
    reports: input.reports
      ? {
          total: input.reports.total,
          items: input.reports.items,
          handledThisWeek: input.reports.handledThisWeek,
          avgHandleHours: input.reports.avgHandleHours,
        }
      : { total: reports.length, items: reports, handledThisWeek: 14, avgHandleHours: 5 },
    expiringAds: input.expiring
      ? { total: input.expiring.total, items: input.expiring.items.slice(0, 5) }
      : { total: expiringAds.length, items: expiringAds },
  };
}
