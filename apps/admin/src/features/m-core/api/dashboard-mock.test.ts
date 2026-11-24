import type { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockQueues, mockSummary } from '@/app/mock-api/v1/admin/dashboard/_fixtures';
import {
  remoteDealRequests,
  remoteExpiringAds,
  remoteReports,
} from '@/app/mock-api/v1/admin/dashboard/_remote';
import { dashboardQueuesSchema, dashboardSummarySchema } from './schemas';

/**
 * The dashboard mock aggregates the sibling mock resources (like the real endpoint aggregates the
 * modules). These tests pin the mapping from their list payloads to the dashboard shapes.
 */
const now = Date.parse('2026-11-24T00:10:00Z'); // 화 09:10 KST
const req = {
  nextUrl: { origin: 'http://localhost:3201' },
  headers: new Headers({ cookie: 'house_admin_sid=x' }),
} as unknown as NextRequest;

function stubFetch(body: unknown, ok = true) {
  // The mock helpers always call fetch(url: string, init) — typed so `mock.calls[0][0]` is the URL.
  const fetchMock = vi.fn(async (_url: string) => ({ ok, json: async () => body }) as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('dashboard mock · deal requests', () => {
  const base = {
    assetType: 'APT',
    complexName: null,
    emdName: null,
    exclusiveArea: null,
    desiredSalePrice: null,
    desiredDeposit: null,
    desiredMonthlyRent: null,
    regionNames: [],
    priceMax: null,
    depositMax: null,
    rentMax: null,
    areaMin: null,
    areaMax: null,
    targetAgencyCount: 0,
    proposalCount: 0,
    spamFlaggedAt: null,
  };
  const page = {
    total: 5,
    items: [
      {
        ...base,
        id: 'older',
        type: 'SELL_OR_LEASE',
        assetType: 'HOUSE',
        dealTypes: ['SALE'],
        emdName: '왕지동',
        exclusiveArea: 132.2,
        desiredSalePrice: 39000,
        targetAgencyCount: 2,
        proposalCount: 1,
        createdAt: '2026-11-21T21:08:00Z',
      },
      {
        ...base,
        id: 'sell',
        type: 'SELL_OR_LEASE',
        dealTypes: ['SALE'],
        complexName: '신대 레이크파크 1단지',
        emdName: '해룡면 신대리',
        exclusiveArea: 84.98,
        desiredSalePrice: 45000,
        createdAt: '2026-11-23T23:56:00Z',
      },
      {
        ...base,
        id: 'want',
        type: 'WANTED',
        dealTypes: ['SALE'],
        regionNames: ['신대지구', '선월지구'],
        priceMax: 45000,
        areaMin: 84,
        areaMax: 85,
        targetAgencyCount: 4,
        createdAt: '2026-11-23T23:30:00Z',
      },
      {
        ...base,
        id: 'room',
        type: 'WANTED',
        assetType: 'ONEROOM',
        dealTypes: ['MONTHLY'],
        regionNames: ['석현동', '덕월동', '장천동', '매곡동'],
        depositMax: 500,
        rentMax: 40,
        targetAgencyCount: 4,
        createdAt: '2026-11-23T16:00:00Z',
      },
      {
        ...base,
        id: 'spam',
        type: 'WANTED',
        dealTypes: ['MONTHLY'],
        regionNames: ['석현동'],
        rentMax: 20,
        spamFlaggedAt: '2026-11-23T15:00:00Z',
        createdAt: '2026-11-23T14:38:00Z',
      },
    ],
  };

  it('maps open requests to dashboard rows, newest first, without spam', async () => {
    const fetchMock = stubFetch(page);
    const result = await remoteDealRequests(req, now);
    expect(fetchMock.mock.calls[0]![0]).toBe(
      'http://localhost:3201/mock-api/v1/admin/deal-requests?status=OPEN&pageSize=100&_delay=1',
    );
    expect(result?.total).toBe(4);
    expect(result?.items.map((r) => [r.id, r.title])).toEqual([
      ['sell', '신대 레이크파크 1단지 · 전용 85㎡'],
      ['want', '신대지구·선월지구 · 전용 85㎡'],
      ['room', '석현동·덕월동 외 2곳 · 원룸·투룸'],
      ['older', '왕지동 주택 · 전용 132㎡'],
    ]);
    // 09:10 KST: only the two requests after midnight KST (15:00Z) count as today
    expect(result?.kpi).toEqual({ today: 3, sell: 1, find: 2, unassigned: 1 });

    const queues = dashboardQueuesSchema.parse(mockQueues({ now, dealRequests: result }));
    expect(queues.dealRequests.total).toBe(4);
    expect(queues.dealRequests.items[0]).toMatchObject({
      type: 'SELL_OR_LEASE',
      dealType: 'SALE',
      price: 45000,
      deliveredAgencyCount: 0,
    });
    expect(queues.dealRequests.items[2]).toMatchObject({
      dealType: 'MONTHLY',
      deposit: 500,
      monthlyRent: 40,
    });
    const summary = dashboardSummarySchema.parse(mockSummary({ now, dealRequests: result }));
    expect(summary.badges.dealRequestsOpen).toBe(4);
    expect(summary.kpis.dealRequests.today).toBe(3);
  });

  it('falls back to the local fixtures when the sibling mock is unavailable', async () => {
    stubFetch({ code: 'NOT_FOUND', message: 'x' }, false);
    expect(await remoteDealRequests(req, now)).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    expect(await remoteReports(req, now)).toBeNull();
    stubFetch({ unexpected: true });
    expect(await remoteExpiringAds(req, now)).toBeNull();
    expect(dashboardQueuesSchema.parse(mockQueues({ now })).dealRequests.items).toHaveLength(5);
  });
});

describe('dashboard mock · reports', () => {
  const listing = {
    id: 'l-1',
    title: '연향 센트럴 32평',
    complexName: '연향 센트럴',
    dealType: 'SALE',
    salePrice: 31000,
    deposit: null,
    monthlyRent: null,
  };
  const agency = { id: 'a-1', name: '연향센트럴 공인중개사사무소' };
  const page = {
    items: [
      {
        id: 'r1',
        targetType: 'LISTING',
        reason: 'WRONG_PRICE',
        status: 'RECEIVED',
        createdAt: '2026-11-23T23:28:00Z',
        listing,
        agency,
      },
      {
        id: 'r2',
        targetType: 'LISTING',
        reason: 'WRONG_PRICE',
        status: 'RECEIVED',
        createdAt: '2026-11-23T20:43:00Z',
        listing,
        agency,
      },
      {
        id: 'r3',
        targetType: 'LISTING',
        reason: 'ALREADY_DEALT',
        status: 'IN_REVIEW',
        createdAt: '2026-11-23T21:58:00Z',
        listing: {
          id: 'l-2',
          buildingName: '석현동 해오름빌',
          dealType: 'MONTHLY',
          deposit: 500,
          monthlyRent: 42,
        },
        agency: { id: 'a-2', name: '순천대정문 공인중개사사무소' },
      },
      {
        id: 'r4',
        targetType: 'AGENCY',
        reason: 'UNREACHABLE',
        status: 'RECEIVED',
        createdAt: '2026-11-23T19:03:00Z',
        listing: null,
        agency: { id: 'a-3', name: '금당리버 공인중개사사무소' },
      },
      {
        id: 'r5',
        targetType: 'LISTING',
        reason: 'NOT_EXIST',
        status: 'RESOLVED',
        createdAt: '2026-11-22T00:00:00Z',
        handledAt: '2026-11-22T06:00:00Z',
        listing,
        agency,
      },
      {
        id: 'r6',
        targetType: 'LISTING',
        reason: 'DUPLICATE',
        status: 'REJECTED',
        createdAt: '2026-11-20T00:00:00Z',
        handledAt: '2026-11-20T03:00:00Z',
        listing,
        agency,
      },
      {
        id: 'r7',
        targetType: 'LISTING',
        reason: 'DUPLICATE',
        status: 'REJECTED',
        createdAt: '2026-11-01T00:00:00Z',
        handledAt: '2026-11-02T00:00:00Z',
        listing,
        agency,
      },
    ],
  };

  it('groups open reports by target and computes this week’s handling stats', async () => {
    stubFetch(page);
    const result = await remoteReports(req, now);
    expect(result).toMatchObject({ open: 4, total: 3, handledThisWeek: 2, avgHandleHours: 4.5 });
    expect(result?.items).toEqual([
      {
        id: 'r1',
        targetType: 'LISTING',
        targetId: 'l-1',
        reason: 'WRONG_PRICE',
        title: '연향 센트럴 매매 3억 1,000',
        agencyName: '연향센트럴 공인중개사사무소',
        reportCount: 2,
        lastReportedAt: '2026-11-23T23:28:00Z',
      },
      {
        id: 'r3',
        targetType: 'LISTING',
        targetId: 'l-2',
        reason: 'ALREADY_DEALT',
        title: '석현동 해오름빌 월세 500/42',
        agencyName: '순천대정문 공인중개사사무소',
        reportCount: 1,
        lastReportedAt: '2026-11-23T21:58:00Z',
      },
      {
        id: 'r4',
        targetType: 'AGENCY',
        targetId: 'a-3',
        reason: 'UNREACHABLE',
        title: '금당리버 공인중개사사무소',
        agencyName: null,
        reportCount: 1,
        lastReportedAt: '2026-11-23T19:03:00Z',
      },
    ]);
    const queues = dashboardQueuesSchema.parse(mockQueues({ now, reports: result }));
    expect(queues.reports).toMatchObject({ total: 3, handledThisWeek: 2, avgHandleHours: 4.5 });
    expect(
      dashboardSummarySchema.parse(mockSummary({ now, reports: result })).badges.reportsOpen,
    ).toBe(4);
  });
});

describe('dashboard mock · expiring ads', () => {
  const banner = (id: string, endAt: string, extra: Record<string, unknown> = {}) => ({
    id,
    slot: 'MAP_AD',
    title: `${id} 제목`,
    advertiserName: null,
    agency: null,
    endAt,
    status: 'ACTIVE',
    impressions: 1000,
    clicks: 28,
    pcMedia: null,
    ...extra,
  });

  it('keeps live banners ending within seven KST days, soonest first', async () => {
    const fetchMock = stubFetch({
      items: [
        banner('far', '2026-12-20T14:59:59Z'),
        banner('d7', '2026-12-01T14:59:59Z', {
          slot: 'MAIN_HERO',
          advertiserName: '분양 광고주 A',
          pcMedia: { variants: { thumb: { url: '/media/banners/ad-01.webp' } } },
        }),
        banner('d3', '2026-11-27T14:59:59Z', { agency: { name: '신대중앙 공인중개사사무소' } }),
        banner('today', '2026-11-24T14:59:59Z', { impressions: 0, clicks: 0 }),
        banner('ended', '2026-11-23T14:59:59Z'),
        banner('d8', '2026-12-02T14:59:59Z'),
      ],
    });
    const result = await remoteExpiringAds(req, now);
    expect(fetchMock.mock.calls[0]![0]).toContain('/admin/banners?status=ACTIVE');
    expect(result?.items.map((a) => [a.id, a.advertiserName, a.ctr, a.imageUrl])).toEqual([
      ['today', 'today 제목', null, null],
      ['d3', '신대중앙 공인중개사사무소', 0.028, null],
      ['d7', '분양 광고주 A', 0.028, '/media/banners/ad-01.webp'],
    ]);
    const queues = dashboardQueuesSchema.parse(mockQueues({ now, expiring: result }));
    expect(queues.expiringAds.total).toBe(3);
    expect(queues.expiringAds.items[2]).toMatchObject({ kind: 'BANNER', slot: 'MAIN_HERO' });
  });
});

describe('search mock · corpus from the sibling mocks', () => {
  it('builds listing rows with a derived 매물번호 and a headline', async () => {
    const { remoteListings, mockListingNo } = await import(
      '@/app/mock-api/v1/admin/search/_remote'
    );
    const { adminSearchSchema } = await import('./schemas');
    stubFetch({
      items: [
        {
          id: 'b7000000-0000-4000-8000-000000000001',
          title: null,
          dealType: 'SALE',
          status: 'ACTIVE',
          salePrice: 44500,
          complexName: '신대 레이크파크 1단지',
          dong: '103동',
          emdName: '해룡면 신대리',
          supplyArea: 112.4,
          primaryAgency: { id: 'a1', name: '신대중앙 공인중개사사무소' },
        },
        {
          id: 'b7000000-0000-4000-8000-000000000010',
          title: '순천대 정문 도보 6분 투룸',
          dealType: 'MONTHLY',
          status: 'HIDDEN',
          deposit: 500,
          monthlyRent: 42,
          buildingName: '석현동 해오름빌',
          emdName: '석현동',
          primaryAgency: { id: 'a6', name: '순천대정문 공인중개사사무소' },
        },
      ],
    });
    const rows = await remoteListings(req);
    expect(mockListingNo('b7000000-0000-4000-8000-000000000010')).toBe('26110010');
    expect(rows?.map((r) => r.item)).toEqual([
      {
        id: 'b7000000-0000-4000-8000-000000000001',
        listingNo: '26110001',
        title: '신대 레이크파크 1단지 103동 34평',
        dealType: 'SALE',
        price: 44500,
        deposit: null,
        monthlyRent: null,
        status: 'ACTIVE',
        agencyName: '신대중앙 공인중개사사무소',
        areaName: '해룡면 신대리',
      },
      {
        id: 'b7000000-0000-4000-8000-000000000010',
        listingNo: '26110010',
        title: '순천대 정문 도보 6분 투룸',
        dealType: 'MONTHLY',
        price: null,
        deposit: 500,
        monthlyRent: 42,
        status: 'HIDDEN',
        agencyName: '순천대정문 공인중개사사무소',
        areaName: '석현동',
      },
    ]);
    // the building name is searchable even though the marketing title is shown
    expect(rows?.[1]?.match).toContain('석현동 해오름빌');
    const empty = { total: 0, items: [] };
    expect(
      adminSearchSchema.safeParse({
        query: '신대',
        listings: { total: 2, items: rows?.map((r) => r.item) },
        agencies: empty,
        users: empty,
      }).success,
    ).toBe(true);
  });

  it('masks member contact details but keeps them searchable', async () => {
    const { remoteUsers, maskEmail, maskName, maskPhone } = await import(
      '@/app/mock-api/v1/admin/search/_remote'
    );
    expect(maskEmail('user001@example.com')).toBe('us***@example.com');
    expect(maskEmail('a@example.com')).toBe('a***@example.com');
    expect(maskPhone('01000001001')).toBe('010-****-1001');
    expect(maskPhone('010-1234-5678')).toBe('010-****-5678');
    expect(maskName('김서진')).toBe('김*진');
    expect(maskName('한결')).toBe('한*');
    stubFetch({
      items: [
        {
          id: 'u1',
          name: '김서진',
          nickname: '순천토박이',
          email: 'user001@example.com',
          phone: '01000001001',
          role: 'AGENCY_OWNER',
          status: 'ACTIVE',
          providers: ['KAKAO', 'NAVER'],
          createdAt: '2026-01-07T00:00:00Z',
        },
        {
          id: 'u2',
          name: null,
          nickname: null,
          email: null,
          phone: null,
          role: 'USER',
          status: 'WITHDRAWN',
          providers: [],
        },
      ],
    });
    const rows = await remoteUsers(req);
    expect(rows?.[0]?.item).toEqual({
      id: 'u1',
      nickname: '순천토박이',
      name: '김*진',
      email: 'us***@example.com',
      phone: '010-****-1001',
      role: 'AGENCY_OWNER',
      status: 'ACTIVE',
      provider: 'KAKAO',
      joinedAt: '2026-01-07T00:00:00Z',
    });
    expect(rows?.[0]?.match).toContain('01000001001');
    expect(JSON.stringify(rows?.map((r) => r.item))).not.toContain('01000001001');
    expect(rows?.[1]?.item).toMatchObject({
      nickname: '(닉네임 없음)',
      email: null,
      provider: null,
    });
  });
});
