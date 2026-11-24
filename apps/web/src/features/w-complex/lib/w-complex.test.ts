import { ListingSort } from '@house/shared';
import {
  complexAreaTypeSchema,
  complexListingItemSchema,
  complexDetailSchema,
} from '../api/schemas';
import type { ComplexListingSummary, TradeRecord, TradeStat } from '../api/schemas';
import {
  completionLabel,
  complexFacts,
  complexOverview,
  dealRangeText,
  formatDistance,
} from './complex';
import {
  PANEL_FILTERS,
  activeFilterCount,
  areaOptions,
  bandLabel,
  clearedFilters,
  dealOptions,
  parseBand,
  priceBands,
  priceOptions,
  sortOf,
  toListingQuery,
  unitOf,
  type PanelFilterValues,
} from './filters';
import {
  agencyMeta,
  askingSummary,
  headlineAmount,
  listingHeadline,
  listingLabel,
  listingSpecs,
} from './listing';
import { complexMapHref } from './links';
import { complexMarkers, markerName } from './markers';
import {
  currentYm,
  dealDateLabel,
  dealMonthLabel,
  defaultAreaType,
  latestByAreaType,
  summarizeTrend,
  trendSeries,
  trendWindow,
  ymAdd,
  ymLabel,
} from './trend';
import { defaultFilters, parseFilters } from '@/lib/map';

const areaTypes = [
  {
    id: 'a25',
    exclusiveArea: 59.97,
    supplyArea: 82.64,
    typeName: '59A',
    pyeongLabel: '25평',
    households: 412,
  },
  {
    id: 'a34',
    exclusiveArea: '84.98',
    supplyArea: '112.40',
    typeName: '84A',
    pyeongLabel: '34평',
    households: 724,
  },
  {
    id: 'a34b',
    exclusiveArea: 84.6,
    supplyArea: 111.9,
    typeName: '84B',
    pyeongLabel: '34평',
    households: 100,
  },
  {
    id: 'a41',
    exclusiveArea: 101.92,
    supplyArea: 135.54,
    typeName: '101A',
    pyeongLabel: '41평',
    households: 276,
  },
].map((a) => complexAreaTypeSchema.parse(a));

const listing = (over: Record<string, unknown> = {}) =>
  complexListingItemSchema.parse({
    id: 'L01',
    dealType: 'SALE',
    salePrice: 44500,
    dong: '103동',
    totalFloors: 25,
    floorClass: 'HIGH',
    exclusiveArea: '84.98',
    supplyArea: 112.4,
    pyeongLabel: '34평',
    rooms: 3,
    baths: 2,
    direction: 'SOUTH',
    agencyCount: 3,
    ...over,
  });

const stat = (yearMonth: number, medianPrice: number, tradeCount = 1): TradeStat => ({
  yearMonth,
  tradeCount,
  medianPrice,
  minPrice: medianPrice,
  maxPrice: medianPrice,
  avgPrice: medianPrice,
  medianMonthlyRent: null,
});

const summary: ComplexListingSummary = {
  total: 56,
  byDealType: [
    { dealType: 'SALE', count: 38, priceMin: 39000, priceMax: 48500, rentMin: null, rentMax: null },
    {
      dealType: 'JEONSE',
      count: 12,
      priceMin: 26000,
      priceMax: 31000,
      rentMin: null,
      rentMax: null,
    },
    { dealType: 'MONTHLY', count: 6, priceMin: 3000, priceMax: 5000, rentMin: 85, rentMax: 90 },
    { dealType: 'PRESALE', count: 0, priceMin: null, priceMax: null, rentMin: null, rentMax: null },
  ],
  dongs: ['101동', '103동'],
};

const filters = (over: Partial<PanelFilterValues> = {}): PanelFilterValues => ({
  ...defaultFilters(PANEL_FILTERS),
  ...over,
});

describe('trend', () => {
  it('adds months across year boundaries', () => {
    expect(ymAdd(202601, -2)).toBe(202511);
    expect(ymAdd(202610, -11)).toBe(202511);
    expect(ymAdd(202512, 1)).toBe(202601);
    expect(ymLabel(202511)).toBe('25.11');
  });

  it('labels trade dates', () => {
    expect(dealMonthLabel('2026-10-08')).toBe('26.10');
    expect(dealDateLabel('2026-10-08')).toBe('26.10.08');
    expect(dealMonthLabel('bad')).toBe('');
  });

  it('reads the current month in Asia/Seoul', () => {
    // 2026-11-30T16:00Z is already December 1st in Seoul.
    expect(currentYm(new Date('2026-11-30T16:00:00Z'))).toBe(202612);
    expect(currentYm(new Date('2026-11-30T14:00:00Z'))).toBe(202611);
  });

  it('keeps only the months of the window that ends at the current month', () => {
    const stats = [
      stat(202610, 43500),
      stat(202509, 40200),
      stat(202511, 41000),
      stat(202603, 41600),
    ];
    expect(trendWindow(stats, 12, 202611).map((s) => s.yearMonth)).toEqual([202603, 202610]);
    expect(trendWindow(stats, 12, 202610).map((s) => s.yearMonth)).toEqual([
      202511, 202603, 202610,
    ]);
    expect(trendWindow(stats, null, 202611)).toHaveLength(4);
  });

  it('summarises the window: values, axis labels, delta and trade count', () => {
    const t = summarizeTrend(
      [stat(202511, 41000, 2), stat(202603, 41600), stat(202610, 43500)],
      12,
      202610,
    );
    expect(t.values).toEqual([41000, 41600, 43500]);
    expect([t.startLabel, t.endLabel]).toEqual(['25.11', '26.10']);
    expect(t.delta).toBe(2500);
    expect(t.tradeCount).toBe(4);
    expect(summarizeTrend([stat(202610, 43500)], 12, 202611).delta).toBeNull();
    expect(summarizeTrend([], 12, 202611)).toMatchObject({
      values: [],
      delta: null,
      startLabel: '',
    });
  });

  it('does not call a stale series "최근 1년": the window is empty and the last trade is reported', () => {
    const t = summarizeTrend([stat(202402, 30000), stat(202403, 30500, 2)], 12, 202611);
    expect(t).toMatchObject({ values: [], delta: null, tradeCount: 0, lastTradeLabel: '24.03' });
  });

  it('draws a sparse series on a calendar axis with gaps', () => {
    const s = trendSeries(
      [stat(202512, 41000), stat(202603, 41600), stat(202604, 42000)],
      12,
      202611,
    );
    expect(s.bucket).toBe(1);
    expect(s.labels).toHaveLength(12);
    expect(s.labels[0]).toBe('25.12');
    expect(s.labels[11]).toBe('26.11');
    expect(s.values).toEqual([
      41000,
      null,
      null,
      41600,
      42000,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(s.rangeLabel).toBe('25.12 ~ 26.11');
    expect(s.hasData).toBe(true);
  });

  it('groups long windows into calendar quarters / half years (weighted median)', () => {
    const s = trendSeries(
      [stat(202410, 40000, 1), stat(202411, 41000, 3), stat(202606, 43000)],
      36,
      202611,
    );
    expect(s.bucket).toBe(3);
    expect(s.labels[0]).toBe('23년 4분기');
    expect(s.labels[s.labels.length - 1]).toBe('26년 4분기');
    // 24.10 (1 trade) + 24.11 (3 trades) → the weighted median is 24.11's.
    expect(s.values[s.labels.indexOf('24년 4분기')]).toBe(41000);
    expect(s.values[s.labels.indexOf('26년 2분기')]).toBe(43000);
    expect(s.values[s.labels.indexOf('25년 1분기')]).toBeNull();
    expect(trendSeries([stat(201601, 20000)], null, 202611).bucket).toBe(6);
    expect(trendSeries([], 12, 202611)).toMatchObject({ hasData: false });
    expect(trendSeries([stat(202301, 1)], 12, 202611)).toMatchObject({ hasData: false });
  });

  it('picks the latest non-cancelled trade per 평형 and deal type', () => {
    const trade = (over: Partial<TradeRecord>): TradeRecord => ({
      id: 't',
      areaTypeId: 'a34',
      dealType: 'SALE',
      dealDate: '2026-10-08',
      dealYm: 202610,
      exclusiveArea: 84.98,
      floor: 4,
      price: 43500,
      deposit: null,
      monthlyRent: null,
      cancelled: false,
      contractType: null,
      ...over,
    });
    const rows = latestByAreaType(areaTypes, [
      trade({ dealDate: '2026-09-23', price: 43200 }),
      trade({}),
      trade({ dealDate: '2026-10-20', price: 99999, cancelled: true }),
      trade({ dealType: 'JEONSE', price: null, deposit: 27500 }),
      trade({ areaTypeId: 'a25', dealDate: '2026-08-20', price: 31000 }),
    ]);
    expect(rows.map((r) => r.areaType.id)).toEqual(['a25', 'a34b', 'a34', 'a41']);
    expect(rows.find((r) => r.areaType.id === 'a34')?.trade?.price).toBe(43500);
    expect(rows.find((r) => r.areaType.id === 'a41')?.trade).toBeNull();
  });

  it('defaults to the 평형 with the most households', () => {
    expect(defaultAreaType(areaTypes)?.id).toBe('a34');
    expect(defaultAreaType([])).toBeNull();
  });
});

describe('panel filters', () => {
  it('cuts price bands inside the price range, half-open, so every band can match', () => {
    expect(priceBands(39000, 48500).map((b) => b.label)).toEqual([
      '4억 미만',
      '4억~4억 5,000',
      '4억 5,000 이상',
    ]);
    expect(priceBands(26000, 31000).map((b) => b.value)).toEqual([
      '-27500',
      '27500-30000',
      '30000-',
    ]);
    expect(priceBands(null, null)).toEqual([]);
    expect(priceBands(40000, 40000)).toEqual([]);
  });

  it.each([
    [39000, 48500],
    [26000, 31000],
    [3000, 5000],
    [300, 1000],
    [12000, 98000],
  ])('every band of %i–%i overlaps the range and each price falls in exactly one', (min, max) => {
    const bands = priceBands(min, max);
    expect(bands.length).toBeGreaterThanOrEqual(2);
    const contains = (b: (typeof bands)[number], p: number) =>
      (b.min === null || p >= b.min) && (b.max === null || p < b.max);
    for (const b of bands)
      expect((b.min ?? -Infinity) <= max && (b.max ?? Infinity) > min).toBe(true);
    for (const p of [min, Math.round((min + max) / 2), max])
      expect(bands.filter((b) => contains(b, p))).toHaveLength(1);
  });

  it('sends the exclusive upper bound of a band as max - 1 (4억 itself belongs to "4억~")', () => {
    const q = toListingQuery(filters({ 'c-deal': 'SALE', 'c-price': '-40000' }), areaTypes);
    expect(q).toMatchObject({ priceMax: 39999 });
    expect(q.priceMin).toBeUndefined();
  });

  it('uses finer steps below 1억', () => {
    expect(priceBands(300, 1000).map((b) => b.label)).toEqual([
      '500만 미만',
      '500만~1,000만',
      '1,000만 이상',
    ]);
  });

  it('labels band keys that are no longer offered (shared URLs)', () => {
    expect(bandLabel('30000-40000')).toBe('3억~4억');
    expect(bandLabel('-30000')).toBe('3억 미만');
    expect(bandLabel('40000-')).toBe('4억 이상');
    expect(bandLabel('junk')).toBe('junk');
  });

  it('round-trips band keys', () => {
    expect(parseBand('30000-40000')).toEqual({ min: 30000, max: 40000 });
    expect(parseBand('-30000')).toEqual({ min: undefined, max: 30000 });
    expect(parseBand('40000-')).toEqual({ min: 40000, max: undefined });
    expect(parseBand('-')).toBeNull();
    expect(parseBand('abc')).toBeNull();
    expect(parseBand(null)).toBeNull();
  });

  it('offers only deal types that have listings', () => {
    expect(dealOptions(summary).map((o) => o.label)).toEqual(['매매', '전세', '월세']);
    expect(dealOptions(undefined)).toHaveLength(4);
  });

  it('bases 금액 options on the chosen deal type', () => {
    expect(priceOptions(summary, null)[1]?.label).toBe('4억~4억 5,000');
    expect(priceOptions(summary, 'JEONSE')[1]?.label).toBe('2억 7,500~3억');
    expect(priceOptions(summary, 'PRESALE')).toEqual([]);
  });

  it('groups 평형 with the same whole 전용㎡ and labels them in the chosen unit', () => {
    expect(areaOptions(areaTypes, 'pyeong')).toEqual([
      { value: '59', label: '25평' },
      { value: '84', label: '34평' },
      { value: '101', label: '41평' },
    ]);
    expect(areaOptions(areaTypes, 'sqm').map((o) => o.label)).toEqual(['82㎡', '111㎡', '135㎡']);
  });

  it('translates filters into the listing query', () => {
    expect(toListingQuery(filters(), areaTypes)).toEqual({ sort: ListingSort.VERIFIED });
    const q = toListingQuery(
      filters({
        'c-deal': 'SALE',
        'c-area': '84',
        'c-price': '30000-40000',
        'c-dir': 'SOUTH',
        'c-dong': '103동',
        'c-floor': 'HIGH',
        'c-rooms': 3,
        'c-baths': 2,
        'c-sort': ListingSort.PRICE_ASC,
      }),
      areaTypes,
    );
    expect(q).toEqual({
      sort: ListingSort.PRICE_ASC,
      dealTypes: ['SALE'],
      areaMin: 84.1,
      areaMax: 85.48,
      priceMin: 30000,
      priceMax: 39999,
      directions: ['SOUTH'],
      floorClasses: ['HIGH'],
      dong: '103동',
      roomsMin: 3,
      bathsMin: 2,
    });
  });

  it('sends 금액 as 보증금 for 전세·월세 and as both when no deal type is chosen', () => {
    expect(
      toListingQuery(filters({ 'c-deal': 'JEONSE', 'c-price': '-20000' }), areaTypes),
    ).toMatchObject({
      depositMax: 19999,
    });
    expect(
      toListingQuery(filters({ 'c-deal': 'JEONSE', 'c-price': '-20000' }), areaTypes),
    ).not.toHaveProperty('priceMax');
    expect(toListingQuery(filters({ 'c-price': '40000-' }), areaTypes)).toMatchObject({
      priceMin: 40000,
      depositMin: 40000,
    });
  });

  it('ignores unknown enum values from a hand-edited URL', () => {
    const f = parseFilters(
      PANEL_FILTERS,
      new URLSearchParams('c-deal=RENT&c-dir=UP&c-floor=TOP&c-sort=NOPE&c-unit=acre&c-area=999'),
    );
    expect(toListingQuery(f, areaTypes)).toEqual({ sort: ListingSort.VERIFIED });
    expect(sortOf(f)).toBe(ListingSort.VERIFIED);
    expect(unitOf(f)).toBe('pyeong');
  });

  it('counts and clears list-narrowing filters only', () => {
    const f = filters({
      'c-deal': 'SALE',
      'c-rooms': 3,
      'c-unit': 'sqm',
      'c-sort': ListingSort.PHOTO,
    });
    expect(activeFilterCount(f)).toBe(2);
    expect(activeFilterCount({ ...f, ...clearedFilters() })).toBe(0);
    expect(unitOf(f)).toBe('sqm');
  });
});

describe('listing rows', () => {
  it('formats the headline price per deal type', () => {
    expect(listingHeadline(listing())).toEqual({ deal: 'sale', price: '4억 4,500', priceTo: null });
    expect(
      listingHeadline(
        listing({ dealType: 'MONTHLY', salePrice: null, deposit: 3000, monthlyRent: 90 }),
      ),
    ).toMatchObject({ deal: 'monthly', price: '3,000/90' });
    expect(
      listingHeadline(listing({ dealType: 'JEONSE', salePrice: null, deposit: 28000 })).price,
    ).toBe('2억 8,000');
    expect(listingHeadline(listing({ salePrice: null })).price).toBe('가격 협의');
  });

  it('adds 분양가 and premium for 분양권', () => {
    const l = listing({ dealType: 'PRESALE', salePrice: null, presalePrice: 39200, premium: 2700 });
    expect(headlineAmount(l)).toBe(41900);
    expect(listingHeadline(l).price).toBe('4억 1,900');
    expect(
      headlineAmount(
        listing({ dealType: 'PRESALE', salePrice: null, presalePrice: 35000, premium: -1200 }),
      ),
    ).toBe(33800);
  });

  it('shows a range when offices advertise different prices', () => {
    const l = listing({ salePrice: 42000, priceMin: 42000, priceMax: 43000, agencies: [] });
    expect(listingHeadline(l)).toMatchObject({ price: '4억 2,000', priceTo: '4억 3,000' });
    expect(askingSummary(l)).toBe('호가 4억 2,000 ~ 4억 3,000');
    expect(listingLabel(l)).toBe('103동 34평 매매 4억 2,000 ~ 4억 3,000');
  });

  it('builds the spec line in 평 and ㎡', () => {
    expect(listingSpecs(listing(), 'pyeong')).toEqual({
      dong: '103동',
      floor: '고/25층',
      area: '34평',
      exclusive: '전용 84㎡',
      direction: '남향',
      rooms: '방3·욕2',
    });
    expect(listingSpecs(listing(), 'sqm').area).toBe('112㎡');
    expect(listingSpecs(listing({ floor: 17, floorDisplay: 'EXACT' }), 'pyeong').floor).toBe(
      '고/25층',
    );
  });

  it('describes co-brokering offices', () => {
    const agencies = [
      {
        agencyId: 'b1',
        name: '신대중앙',
        representativeName: '김서진',
        complexListingCount: 18,
        avgResponseMinutes: 12,
      },
      { agencyId: 'b2', name: '호수공원' },
    ];
    const l = listing({ agencies });
    expect(askingSummary(l)).toBe('호가 모두 4억 4,500');
    expect(agencyMeta(l.agencies[0]!)).toEqual({
      ceo: '대표 김서진',
      rest: '이 단지 매물 18 · 응답 12분',
    });
    expect(agencyMeta(l.agencies[1]!)).toEqual({ ceo: null, rest: '' });
  });
});

describe('complex facts', () => {
  const complex = complexDetailSchema.parse({
    id: 'c1',
    name: '신대 레이크파크 1단지',
    lat: 34.92,
    lng: 127.58,
    households: 1412,
    buildings: 12,
    floorsMin: 18,
    floorsMax: 25,
    approvalDate: '2019-06-28',
    builtYear: 2019,
    parkingTotal: 1949,
    parkingPerHousehold: '1.38',
    floorAreaRatio: '229.00',
    buildingCoverageRatio: 17.4,
  });

  it('accepts Decimal strings from the API', () => {
    expect(complex.parkingPerHousehold).toBe(1.38);
    expect(complex.floorAreaRatio).toBe(229);
    expect(areaTypes[1]?.exclusiveArea).toBe(84.98);
  });

  it('builds the one-line facts of the panel like the design', () => {
    expect(complexFacts(complex)).toEqual([
      { label: '세대수', value: '1,412' },
      { label: '준공', value: '2019.06' },
      { label: '동수', value: '12개동' },
      { label: '주차', value: '1.38대' },
      { label: '용적률', value: '229%' },
    ]);
  });

  it('skips unknown facts instead of printing placeholders', () => {
    const bare = complexDetailSchema.parse({ id: 'c2', name: 'x', lat: 34.9, lng: 127.5 });
    expect(complexFacts(bare)).toEqual([]);
    expect(complexOverview(bare)).toEqual([{ label: '유형', value: '아파트' }]);
  });

  it('labels completion, incl. complexes that are not built yet', () => {
    const now = new Date('2026-11-23T00:00:00+09:00');
    expect(completionLabel({ approvalDate: '2019-06-28', builtYear: 2019 }, now)).toBe(
      '2019.06 준공',
    );
    expect(completionLabel({ approvalDate: null, builtYear: 2027 }, now)).toBe('2027년 입주 예정');
    expect(completionLabel({ approvalDate: null, builtYear: 2011 }, now)).toBe('2011년 준공');
    expect(completionLabel({ approvalDate: null, builtYear: null }, now)).toBeNull();
  });

  it('formats distances', () => {
    expect(formatDistance(268)).toBe('268m');
    expect(formatDistance(1390)).toBe('1.4km');
  });
});

describe('deal ranges', () => {
  it('shows 월세 deposit and rent ranges separately (never a fabricated pair)', () => {
    const monthly = summary.byDealType.find((d) => d.dealType === 'MONTHLY')!;
    expect(dealRangeText(monthly)).toBe('보증금 3,000 ~ 5,000 · 월 85~90');
    expect(dealRangeText({ ...monthly, priceMax: 3000, rentMax: 85 })).toBe('보증금 3,000 · 월 85');
    expect(dealRangeText(summary.byDealType[0]!)).toBe('3억 9,000 ~ 4억 8,500');
    expect(dealRangeText({ ...summary.byDealType[0]!, priceMin: null, priceMax: null })).toBe(
      '가격 협의',
    );
  });
});

describe('links', () => {
  it('builds a map URL that centres on the complex and opens its panel', () => {
    const href = complexMapHref({ id: 'c1', lat: 34.9215, lng: 127.58 }, 'JEONSE');
    const url = new URL(href, 'http://x');
    expect(url.pathname).toBe('/map/apt');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      c: '34.9215,127.58',
      z: '16',
      sel: 'c1',
      list: '1',
      complex: 'c1',
      'c-deal': 'JEONSE',
      dealTypes: 'JEONSE',
    });
  });
});

describe('markers', () => {
  it('shortens long names and marks the complex itself last (drawn on top)', () => {
    expect(markerName('신대 레이크파크 1단지')).toBe('레이크파크 1단지');
    expect(markerName('신대 에듀포레')).toBe('신대 에듀포레');
    const markers = complexMarkers(
      { id: 'c1', name: '신대 레이크파크 1단지', lat: 34.92, lng: 127.58, activeListingCount: 56 },
      [
        {
          id: 'n1',
          name: '선월 하이츠 2차',
          assetType: 'APT',
          emdName: null,
          lat: 34.91,
          lng: 127.57,
          distanceM: 1390,
          households: null,
          builtYear: null,
          activeListingCount: 53,
          dealCounts: { presale: 46, sale: 5, jeonse: 0, monthly: 2 },
          representative: { pyeongLabel: '33평', price: 41900, dealType: 'PRESALE' },
        },
      ],
      (v) => `${v / 10000}억`,
    );
    expect(markers).toHaveLength(2);
    expect(markers[0]).toMatchObject({
      id: 'n1',
      presale: true,
      dealNote: '분양권',
      priceLabel: '4.19억',
    });
    expect(markers[1]).toMatchObject({ id: 'c1', count: 56, name: '레이크파크 1단지' });
  });
});
