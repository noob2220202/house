import { describe, expect, it } from 'vitest';
import type { ComplexDetail, TradeRecord } from '@/features/w-complex/api/schemas';
import type { SeoRegionLanding, SeoTradeReport } from '@/lib/seo/schemas';
import { complexFaq, newestTrade } from './complex-faq';
import { landingDescription, landingIntro, reportLead, trendOf } from './facts';

const sale = (over: Partial<SeoRegionLanding['listings']['byDealType'][number]> = {}) => ({
  dealType: 'SALE' as const,
  count: 14,
  minPrice: 31_100,
  maxPrice: 55_300,
  avgPrice: 43_264,
  minRent: null,
  maxRent: null,
  ...over,
});

const LANDING: SeoRegionLanding = {
  region: {
    code: '1215037021',
    name: '신대리',
    emdName: '해룡면 신대리',
    parentName: '해룡면',
    lat: 34.92,
    lng: 127.58,
    listingCounts: { APT: 35, OFFICETEL: 0, ONEROOM: 0, HOUSE: 0, COMMERCIAL: 5, LAND: 0 },
    complexCount: 2,
    saleTradeCount: 108,
    lastModified: null,
  },
  assetTypes: ['APT', 'OFFICETEL'],
  listings: {
    total: 35,
    byDealType: [
      sale(),
      sale({ dealType: 'JEONSE', count: 12, minPrice: 21_500, maxPrice: 46_500 }),
      sale({
        dealType: 'MONTHLY',
        count: 9,
        minPrice: 1_300,
        maxPrice: 3_800,
        minRent: 50,
        maxRent: 95,
      }),
    ],
    lastPublishedAt: null,
  },
  complexes: [],
  complexTotal: 2,
  trades: {
    fromYm: 202512,
    toYm: 202611,
    sale: {
      count: 108,
      avgPrice: 39_198,
      medianPrice: 37_575,
      minPrice: 25_300,
      maxPrice: 63_150,
      avgPricePerPyeong: 1_606,
    },
    jeonse: { count: 92, avgDeposit: 27_316, medianDeposit: 24_850 },
    recent: [],
  },
  updatedAt: '2026-11-24T01:00:00.000Z',
};

describe('landing copy', () => {
  it('states the counts, ranges and 12-month 실거래 from the API', () => {
    const [listings, ranges, trades] = landingIntro(LANDING, 'apt');
    expect(listings).toContain(
      '순천시 해룡면 신대리(신대지구)에는 2026년 11월 24일 기준 아파트 매물 35건',
    );
    expect(listings).toContain('(매매 14건 · 전세 12건 · 월세 9건)');
    expect(listings).toContain('단지 2곳');
    expect(ranges).toContain('매매 호가는 3억 1,100 ~ 5억 5,300');
    expect(ranges).toContain('월세는 보증금 1,300 ~ 3,800, 월 50~95만 원');
    expect(trades).toContain('최근 12개월(2025.12~2026.11) 국토교통부 실거래가 기준');
    expect(trades).toContain(
      '매매는 108건이며 평균 거래가는 3억 9,198만 원, 중위 거래가는 3억 7,575만 원입니다.',
    );
    expect(trades).toContain('중위 보증금은 2억 4,850만 원');
    expect(landingDescription(LANDING, 'apt')).toContain('최근 12개월 매매 실거래 108건');
  });

  it('says so instead of inventing numbers when there is no data', () => {
    const empty: SeoRegionLanding = {
      ...LANDING,
      listings: { total: 0, byDealType: [], lastPublishedAt: null },
      complexTotal: 0,
      trades: {
        ...LANDING.trades!,
        sale: {
          ...LANDING.trades!.sale,
          count: 0,
          avgPrice: null,
          medianPrice: null,
          avgPricePerPyeong: null,
        },
      },
    };
    const lines = landingIntro(empty, 'apt');
    expect(lines[0]).toContain('등록된 아파트 매물은 없습니다');
    expect(lines.join(' ')).toContain('신고된 아파트 매매 실거래는 없습니다');
    expect(lines.join(' ')).not.toMatch(/평균|중위/);
    // Non-아파트 pages never mention 단지 / 실거래.
    expect(landingIntro(LANDING, 'commercial').join(' ')).not.toMatch(/실거래|단지/);
  });
});

describe('report copy', () => {
  const SUMMARY = {
    count: 41,
    avgPrice: 29_495,
    medianPrice: 28_950,
    minPrice: 1,
    maxPrice: 2,
    avgPricePerPyeong: 1_174,
  };
  const REPORT: SeoTradeReport = {
    sggCode: '12150',
    regionName: '순천시',
    yearMonth: 202610,
    latestYearMonth: 202610,
    availableMonths: [202610],
    sale: { ...SUMMARY, cancelledCount: 0 },
    jeonse: { count: 0, avgDeposit: null, medianDeposit: null },
    previous: { yearMonth: 202609, sale: { ...SUMMARY, count: 27 } },
    yearAgo: { yearMonth: 202510, sale: { ...SUMMARY, count: 40 } },
    byRegion: [
      {
        regionCode: '1215037021',
        name: '해룡면 신대리',
        sale: { ...SUMMARY, count: 14, medianPrice: 41_325 },
      },
    ],
    topComplexes: [],
    syncedAt: null,
    updatedAt: '2026-11-24T00:00:00Z',
  };
  it('leads with volume, change and prices', () => {
    const [first, top, yoy] = reportLead(REPORT);
    expect(first).toBe(
      '2026년 10월 순천시 아파트 매매 실거래는 41건입니다(전월 27건 대비 +51.9%). 평균 거래가 2억 9,495만 원, 중위 거래가 2억 8,950만 원, 전용 3.3㎡당 평균 1,174만 원입니다.',
    );
    expect(top).toBe(
      '거래가 가장 많은 곳은 해룡면 신대리로 14건, 중위 거래가 4억 1,325만 원입니다.',
    );
    expect(yoy).toContain('1년 전(2025년 10월) 40건과 비교하면 거래량은 +2.5%');
    expect(trendOf(41, 27, '전월 대비')).toEqual({ text: '전월 대비 +51.9%', direction: 'up' });
    expect(trendOf(41, null, 'x')).toBeNull();
  });
});

describe('complex FAQ', () => {
  const trade = (over: Partial<TradeRecord>): TradeRecord => ({
    id: 't',
    areaTypeId: 'a1',
    dealType: 'SALE',
    dealDate: '2026-11-10',
    dealYm: 202611,
    exclusiveArea: 84.99,
    floor: 3,
    price: 45_950,
    deposit: null,
    monthlyRent: null,
    cancelled: false,
    contractType: null,
    ...over,
  });
  const complex = {
    id: 'c1',
    assetType: 'APT',
    name: '신대 센트럴 파크뷰',
    roadAddress: '전라남도 순천시 해룡면 신대1로 30',
    jibunAddress: null,
    sggCode: '12150',
    emdCode: '1215037021',
    emdName: '해룡면 신대리',
    districtName: null,
    lat: 34.92,
    lng: 127.58,
    households: 1412,
    buildings: 12,
    floorsMin: 15,
    floorsMax: 25,
    approvalDate: '2019-06-28',
    builtYear: 2019,
    parkingTotal: null,
    parkingPerHousehold: null,
    floorAreaRatio: null,
    buildingCoverageRatio: null,
    heatingType: null,
    builder: null,
    viewCount: 0,
    favoriteCount: 0,
    activeListingCount: 3,
    avgPricePerPyeong: null,
    areaTypes: [
      {
        id: 'a1',
        exclusiveArea: 84.99,
        supplyArea: 112.4,
        typeName: '84A',
        pyeongLabel: '34평',
        households: 800,
        rooms: 3,
        baths: 2,
      },
      {
        id: 'a2',
        exclusiveArea: 59.92,
        supplyArea: 79.3,
        typeName: '59A',
        pyeongLabel: '24평',
        households: 612,
        rooms: 3,
        baths: 2,
      },
    ],
    photos: [],
    latestTrades: [],
  } satisfies ComplexDetail;

  it('answers 준공 · 평형 · 실거래 · 매물 · 위치 from the data', () => {
    const items = complexFaq({
      complex,
      listings: {
        total: 3,
        byDealType: [
          {
            dealType: 'SALE',
            count: 3,
            priceMin: 39_000,
            priceMax: 48_500,
            rentMin: null,
            rentMax: null,
          },
        ],
        dongs: [],
      },
      latest: [
        trade({ dealDate: '2026-10-01', price: 44_000 }),
        trade({}),
        trade({ dealType: 'JEONSE', price: null, deposit: 30_000, dealDate: '2026-11-02' }),
        trade({ dealDate: '2026-11-20', cancelled: true }),
      ],
      asOf: new Date('2026-11-24T01:00:00Z'),
    });
    expect(items.map((i) => i.question)).toEqual([
      '신대 센트럴 파크뷰는 언제 준공됐나요?',
      '신대 센트럴 파크뷰 세대수와 평형은 어떻게 되나요?',
      '신대 센트럴 파크뷰 최근 실거래가는 얼마인가요?',
      '신대 센트럴 파크뷰 매물은 지금 몇 건 있나요?',
      '신대 센트럴 파크뷰는 어디에 있나요?',
    ]);
    expect(items[0]?.answer).toBe(
      '신대 센트럴 파크뷰는 2019년 6월 사용승인(준공)된 1,412세대, 12개 동, 최고 25층 규모의 단지입니다.',
    );
    expect(items[1]?.answer).toContain(
      '전용 59.92㎡(24평, 612세대), 전용 84.99㎡(34평, 800세대) 2개 타입',
    );
    expect(items[2]?.answer).toContain(
      '가장 최근 매매는 2026년 11월 10일 전용 84.99㎡ 3층 4억 5,950만 원',
    );
    expect(items[2]?.answer).toContain('전세는 2026년 11월 2일');
    expect(items[3]?.answer).toContain('2026년 11월 24일 기준');
    expect(items[3]?.answer).toContain('매매 3건 3억 9,000 ~ 4억 8,500');
    expect(items[4]?.answer).toContain('순천시 해룡면 신대리(신대지구)');
  });

  it('leaves out questions without facts', () => {
    const bare = {
      ...complex,
      approvalDate: null,
      builtYear: null,
      households: null,
      areaTypes: [],
      roadAddress: null,
      emdName: null,
    };
    const items = complexFaq({ complex: bare, listings: null, latest: [], asOf: new Date() });
    expect(items).toEqual([]);
    expect(newestTrade([], 'SALE')).toBeNull();
  });
});
