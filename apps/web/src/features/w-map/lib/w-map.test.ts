import { AssetType, DealType, ListingSort, MapResultKind } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { defaultFilters, parseFilters } from '@/lib/map';
import {
  complexListSchema,
  listingPageSchema,
  mapSearchResponseSchema,
  type ListingSummary,
  type MapListingMarker,
} from '../api/schemas';
import { rotationIndex } from '../components/map/MapAdCard';
import { ASSETS } from '../config/assets';
import {
  FILTER_SPEC,
  SCALES,
  amountRangeLabel,
  areaRangeLabel,
  builtLabel,
  chipLabel,
  countActive,
  dealLabel,
  hasOptions,
  FULL_OPTION_SET,
  scaleIndex,
  scaleRange,
  toApiFilters,
  toggleOptions,
  type MapFilters,
} from './filters';
import {
  SHEET_PEEK_PX,
  bboxParam,
  centerForTarget,
  cropBottom,
  nearestRegion,
  placePopover,
  projectToViewport,
  scaleBar,
  sheetHeightPx,
} from './geo';
import {
  dealPriceOf,
  formatMarkerPrice,
  listingMeta,
  listingName,
  listingSub,
  markerPriceText,
  priceText,
} from './listing';
import { groupListingMarkers, shortComplexName, toMapMarkers } from './markers';
import { normalizeUi, UI_SPEC } from './state';
import {
  closeAdSlot,
  isAdSlotClosed,
  mergeRecentComplex,
  nextAdRotation,
  type RecentComplex,
} from './storage';

const DEFAULTS = defaultFilters(FILTER_SPEC);
const filters = (patch: Partial<MapFilters> = {}): MapFilters => ({ ...DEFAULTS, ...patch });

describe('map filters → API query', () => {
  it('always sends the asset types of the page and nothing else by default', () => {
    expect(toApiFilters(ASSETS.apt, filters())).toEqual({ assetTypes: ['APT', 'OFFICETEL'] });
    expect(toApiFilters(ASSETS.land, filters())).toEqual({ assetTypes: ['LAND'] });
  });

  it('narrows to a sub type and passes ranges in 만원 / ㎡ under the API names', () => {
    const q = toApiFilters(
      ASSETS.apt,
      filters({
        assetTypes: ['OFFICETEL'],
        dealTypes: ['SALE', 'PRESALE'],
        priceMax: 50000,
        areaMin: 99.17,
        roomsMin: 3,
        verifiedOnly: true,
      }),
    );
    expect(q).toEqual({
      assetTypes: ['OFFICETEL'],
      dealTypes: ['PRESALE', 'SALE'],
      priceMax: 50000,
      areaMin: 99.17,
      roomsMin: 3,
      verifiedOnly: true,
    });
  });

  it('drops unknown enum values, negative numbers and keys the asset does not use', () => {
    const fromUrl = parseFilters(
      FILTER_SPEC,
      new URLSearchParams(
        'dealTypes=SALE,BOGUS&priceMin=-5&directions=UP&landZones=GREEN&roomTypes=TWO_ROOM',
      ),
    );
    // 원룸 has no 매매 and no land filters.
    expect(toApiFilters(ASSETS.oneroom, fromUrl)).toEqual({
      assetTypes: ['ONEROOM'],
      roomTypes: ['TWO_ROOM'],
    });
    expect(toApiFilters(ASSETS.land, fromUrl)).toEqual({
      assetTypes: ['LAND'],
      landZones: ['GREEN'],
    });
  });

  it('counts active filter groups for the mobile badge', () => {
    expect(countActive(ASSETS.apt, filters())).toBe(0);
    expect(
      countActive(
        ASSETS.apt,
        filters({ dealTypes: ['SALE'], priceMin: 10000, priceMax: 30000, verifiedOnly: true }),
      ),
    ).toBe(3);
  });
});

describe('filter labels', () => {
  it('writes amounts with their unit', () => {
    expect(amountRangeLabel(null, null)).toBe('전체');
    expect(amountRangeLabel(null, 10000)).toBe('~ 1억');
    expect(amountRangeLabel(30, 50)).toBe('30 ~ 50만');
    expect(amountRangeLabel(5000, 30000)).toBe('5,000만 ~ 3억');
    expect(amountRangeLabel(30000, null)).toBe('3억 ~');
  });

  it('prints areas in the chosen unit', () => {
    expect(areaRangeLabel(99.17, 132.23, 'pyeong')).toBe('30평 ~ 40평');
    expect(areaRangeLabel(99.17, null, 'sqm')).toBe('99㎡ ~');
    expect(areaRangeLabel(null, null, 'pyeong')).toBe('전체');
  });

  it('labels the deal chip like the design ("분양·매매")', () => {
    expect(dealLabel(ASSETS.apt, filters())).toBe('전체');
    expect(dealLabel(ASSETS.apt, filters({ dealTypes: ['SALE', 'PRESALE'] }))).toBe('분양·매매');
    expect(dealLabel(ASSETS.apt, filters({ dealTypes: ['PRESALE'] }))).toBe('분양권');
    expect(
      dealLabel(ASSETS.apt, filters({ dealTypes: ['SALE', 'PRESALE', 'JEONSE', 'MONTHLY'] })),
    ).toBe('전체');
  });

  it('labels the other chips', () => {
    const f = filters({ builtYearMin: 2016, roomsMin: 3, floorClasses: ['HIGH', 'MID'] });
    expect(builtLabel(f, 2026)).toBe('10년 이내');
    expect(builtLabel(filters({ builtYearMax: 2006 }), 2026)).toBe('20년 이상');
    expect(chipLabel('rooms', ASSETS.apt, f, 'pyeong', 2026)).toBe('3개 이상');
    expect(chipLabel('floor', ASSETS.apt, f, 'pyeong', 2026)).toBe('중층·고층');
    expect(chipLabel('more', ASSETS.apt, f, 'pyeong', 2026)).toBe('2개 적용');
    expect(
      chipLabel('category', ASSETS.apt, filters({ assetTypes: ['OFFICETEL'] }), 'pyeong', 2026),
    ).toBe('오피스텔');
  });

  it('maps slider stops to open-ended ranges and back', () => {
    const scale = SCALES.priceApt;
    const last = scale.length - 1;
    expect(scaleRange(scale, 0, last)).toEqual([null, null]);
    expect(scaleRange(scale, 2, last)).toEqual([10000, null]);
    expect(scaleIndex(scale, null, 'max')).toBe(last);
    expect(scaleIndex(scale, 31000, 'min')).toBe(scale.indexOf(30000));
  });

  it('toggles the 풀옵션 group as a whole', () => {
    const on = toggleOptions(['PARKING'], FULL_OPTION_SET);
    expect(hasOptions(on, FULL_OPTION_SET)).toBe(true);
    expect(toggleOptions(on, FULL_OPTION_SET)).toEqual(['PARKING']);
  });
});

describe('view options', () => {
  it('falls back to the asset defaults and rejects sorts the asset does not offer', () => {
    const raw = parseFilters(UI_SPEC, new URLSearchParams('sort=BUILT_YEAR_DESC&unit=acre&tab=x'));
    expect(normalizeUi(raw, ASSETS.land)).toEqual({
      sort: ListingSort.VERIFIED,
      tab: 'popular',
      // 계량법: ㎡ is the default everywhere (평 is the visitor's choice).
      unit: 'sqm',
      view: 'card',
      tradeLayer: false,
      listOpen: false,
    });
    expect(normalizeUi(raw, ASSETS.oneroom).sort).toBe(ListingSort.BUILT_YEAR_DESC);
    expect(normalizeUi(raw, ASSETS.oneroom).unit).toBe('sqm');
  });
});

describe('map geometry', () => {
  const bounds = { swLat: 34.9, swLng: 127.5, neLat: 35.0, neLng: 127.6 };
  const size = { width: 1000, height: 800 };

  it('serialises the bbox as swLng,swLat,neLng,neLat and clamps huge spans', () => {
    expect(bboxParam(bounds)).toBe('127.500000,34.900000,127.600000,35.000000');
    const wide = bboxParam({ swLat: 30, swLng: 120, neLat: 40, neLng: 135 });
    const [swLng, swLat, neLng, neLat] = wide.split(',').map(Number);
    expect(neLng! - swLng!).toBeCloseTo(2, 6);
    expect(neLat! - swLat!).toBeCloseTo(2, 6);
  });

  it('projects points linearly inside the bounds', () => {
    const mid = projectToViewport({ lat: 34.95, lng: 127.55 }, bounds, size);
    expect(mid.x).toBeCloseTo(500, 6);
    expect(mid.y).toBeCloseTo(400, 6);
    expect(projectToViewport({ lat: 35.0, lng: 127.5 }, bounds, size)).toEqual({ x: 0, y: 0 });
  });

  it('picks a round scale bar that fits', () => {
    const bar = scaleBar(bounds, 1000);
    expect(bar?.label).toBe('500m');
    expect(bar!.px).toBeLessThanOrEqual(72);
    expect(scaleBar(bounds, 0)).toBeNull();
  });

  it('finds the nearest region', () => {
    const regions = [
      { name: 'a', lat: 34.92, lng: 127.58 },
      { name: 'b', lat: 34.97, lng: 127.49 },
    ];
    expect(nearestRegion(regions, { lat: 34.965, lng: 127.5 })?.name).toBe('b');
    expect(nearestRegion([], { lat: 0, lng: 0 })).toBeNull();
  });

  it('places the popover beside the anchor, flips at the edge and avoids reserved boxes', () => {
    const card = { width: 264, height: 300 };
    expect(placePopover({ x: 300, y: 400 }, card, size, { gap: 90 })).toMatchObject({
      side: 'right',
      left: 390,
    });
    expect(placePopover({ x: 900, y: 400 }, card, size, { gap: 90 })).toMatchObject({
      side: 'left',
      left: 900 - 90 - 264,
    });
    // An ad card in the top-right corner pushes the popover to the other side.
    const avoid = [{ left: 680, top: 0, right: 1000, bottom: 260 }];
    expect(placePopover({ x: 500, y: 150 }, card, size, { gap: 90, avoid })).toMatchObject({
      side: 'left',
    });
    // Off-screen anchors are not placed (the card docks instead).
    expect(placePopover({ x: -200, y: 400 }, card, size)).toBeNull();
  });

  it('centres a target in the area the chrome leaves free', () => {
    const scale = { lng: 10_000, lat: 10_000 };
    const target = { lat: 34.95, lng: 127.55 };
    // Mobile: 170px of chips on top, a 430px sheet below → the centre moves 130px south.
    const mobile = centerForTarget(target, { top: 170, right: 0, bottom: 430, left: 0 }, scale);
    expect(mobile.lat).toBeCloseTo(34.95 - 0.013, 9);
    expect(mobile.lng).toBeCloseTo(127.55, 9);
    // Desktop: a 316px ad column on the right → the centre moves 158px east.
    const desktop = centerForTarget(target, { top: 0, right: 316, bottom: 0, left: 0 }, scale);
    expect(desktop.lng).toBeCloseTo(127.55 + 0.0158, 9);
  });

  it('queries only the part of the map above the sheet', () => {
    expect(cropBottom(bounds, 800, 400)).toEqual({ ...bounds, swLat: 34.95 });
    expect(cropBottom(bounds, 800, 0)).toBe(bounds);
    // At least a fifth always stays (a sheet never hides the whole query area).
    expect(cropBottom(bounds, 800, 800).swLat).toBeCloseTo(34.98, 9);
  });

  it('mirrors the CSS sheet stops (half leaves the search + 170px of map on short phones)', () => {
    expect(sheetHeightPx('peek', 780)).toBe(SHEET_PEEK_PX);
    expect(sheetHeightPx('half', 780)).toBeCloseTo(436.8, 6);
    expect(sheetHeightPx('half', 576)).toBe(236);
    expect(sheetHeightPx('half', 400)).toBe(SHEET_PEEK_PX);
    expect(sheetHeightPx('full', 780)).toBe(656);
  });
});

const listing = (patch: Partial<ListingSummary>): ListingSummary => ({
  id: 'l1',
  assetType: AssetType.APT,
  dealType: DealType.SALE,
  status: 'ACTIVE',
  options: [],
  agencyCount: 1,
  photoCount: 0,
  sameBuildingCount: 0,
  ...patch,
});

describe('listing display', () => {
  it('formats the headline price per deal type', () => {
    expect(priceText(listing({ salePrice: 44500 }))).toBe('4억 4,500');
    expect(priceText(listing({ dealType: 'MONTHLY', deposit: 500, monthlyRent: 42 }))).toBe(
      '500/42',
    );
    expect(priceText(listing({ dealType: 'JEONSE', deposit: 9500 }))).toBe('9,500');
    // 분양권 headline = 분양가 + 프리미엄
    expect(
      dealPriceOf(listing({ dealType: 'PRESALE', presalePrice: 39200, premium: 2700 })).price,
    ).toBe(41900);
    expect(priceText(listing({}))).toBe('가격 협의');
  });

  it('formats compact marker prices', () => {
    expect(markerPriceText(listing({ salePrice: 44500 }))).toBe('4.45억');
    expect(markerPriceText(listing({ dealType: 'JEONSE', deposit: 9500 }))).toBe('9,500');
    expect(markerPriceText(listing({ dealType: 'MONTHLY', deposit: 1000, monthlyRent: 45 }))).toBe(
      '1,000/45',
    );
  });

  it('never rounds a marker price up (a pin must not print more than the listing costs)', () => {
    expect(formatMarkerPrice(29500)).toBe('2.95억');
    expect(formatMarkerPrice(13500)).toBe('1.35억');
    expect(formatMarkerPrice(25550)).toBe('2.55억');
    expect(formatMarkerPrice(44000)).toBe('4.4억');
    expect(formatMarkerPrice(39999)).toBe('3.99억');
    expect(formatMarkerPrice(100000)).toBe('10억');
    expect(formatMarkerPrice(9500)).toBe('9,500만');
    expect(markerPriceText(listing({ dealType: 'JEONSE', deposit: 21000 }))).toBe('2.1억');
  });

  it('builds the fact line per asset type', () => {
    const apt = listing({
      complexId: 'c1',
      complexName: '신대 레이크파크 1단지',
      dong: '103동',
      pyeongLabel: '34',
      supplyArea: 112.4,
      exclusiveArea: 84.98,
      totalFloors: 25,
      floorClass: 'HIGH',
      direction: 'SOUTH',
    });
    // 전용면적 in ㎡ with 평 alongside; 평 leads only with the 평 toggle — never 평 alone.
    expect(listingMeta(apt, 'pyeong')).toEqual(['103동', '고/25층', '전용 26평(85㎡)', '남향']);
    expect(listingMeta(apt, 'sqm')).toEqual(['103동', '고/25층', '전용 85㎡(26평)', '남향']);
    expect(listingName(apt)).toBe('신대 레이크파크 1단지');

    const room = listing({
      assetType: 'ONEROOM',
      dealType: 'MONTHLY',
      buildingName: '해오름빌',
      roomType: 'TWO_ROOM',
      exclusiveArea: 36,
      floor: 3,
      totalFloors: 4,
      maintenanceFeeWon: 70000,
      emdName: '석현동',
      builtYear: 2019,
    });
    expect(listingMeta(room, 'sqm')).toEqual(['투룸', '전용 36㎡(11평)', '3/4층', '관리비 7만']);
    expect(listingMeta(room, 'sqm', { fee: false })).toEqual(['투룸', '전용 36㎡(11평)', '3/4층']);
    expect(listingSub(room)).toBe('석현동 · 2019년 준공 · 해오름빌');

    const land = listing({
      assetType: 'LAND',
      title: '해룡면 신대리 대지',
      landArea: 661,
      landCategory: 'DAE',
      landZone: 'RESIDENTIAL',
      salePrice: 100000,
    });
    expect(listingMeta(land, 'pyeong')).toEqual([
      '지목 대',
      '200평(661㎡)',
      '주거지역',
      '500만/평',
    ]);
  });
});

describe('map markers', () => {
  const response = mapSearchResponseSchema.parse({
    kind: MapResultKind.MARKERS,
    total: 60,
    clusters: [],
    markers: [
      {
        type: 'COMPLEX',
        id: 'c1',
        name: '신대 레이크파크 1단지',
        lat: 34.92,
        lng: 127.58,
        count: 38,
        counts: { presale: 0, sale: 38, jeonse: 12, monthly: 6 },
        representative: { pyeongLabel: '34', supplyArea: 112.4, price: 44000, dealType: 'SALE' },
        latestTrade: { price: 42000, pyeongLabel: '34', dealYm: 202610 },
      },
      {
        type: 'COMPLEX',
        id: 'c3',
        name: '선월 하이츠 2차',
        lat: 34.91,
        lng: 127.57,
        count: 46,
        counts: { presale: 46, sale: 0, jeonse: 0, monthly: 0 },
        representative: { pyeongLabel: '33', price: 41900, dealType: 'PRESALE' },
      },
      {
        type: 'LISTING',
        id: 'r1',
        lat: 34.97,
        lng: 127.48,
        dealType: 'MONTHLY',
        deposit: 500,
        monthlyRent: 42,
        count: 3,
      },
    ],
  });

  it('builds complex markers like the design ("34평 4.4억", 분양권 in purple)', () => {
    const [c1, c3, r1] = toMapMarkers(response, { unit: 'pyeong', localPrefix: '신대' });
    expect(c1).toMatchObject({
      kind: 'complex',
      name: '레이크파크 1단지',
      count: 38,
      areaLabel: '34평(112㎡)',
      priceLabel: '4.4억',
      presale: false,
    });
    expect(c3).toMatchObject({ name: '선월 하이츠 2차', dealNote: '분양권', presale: true });
    expect(r1).toMatchObject({ kind: 'price', deal: 'monthly', priceLabel: '500/42 +2' });
  });

  it('supports ㎡, the 실거래가 layer and compact mobile markers', () => {
    expect(toMapMarkers(response, { unit: 'sqm' })[0]).toMatchObject({ areaLabel: '112㎡(34평)' });
    expect(toMapMarkers(response, { unit: 'pyeong', tradeLayer: true })[0]).toMatchObject({
      dealNote: '실거래',
      priceLabel: '4.2억',
    });
    const compact = toMapMarkers(response, { unit: 'pyeong', compact: true, selectedId: 'c3' });
    expect(compact[0]).toMatchObject({ name: '', areaLabel: undefined, priceLabel: '4.4억' });
    expect(compact[1]).toMatchObject({ name: '선월 하이츠 2차' });
    expect(compact[0]?.ariaLabel).toContain('신대 레이크파크 1단지');
  });

  it('turns clusters into bubbles and sizes them by weight', () => {
    const clusters = mapSearchResponseSchema.parse({
      kind: MapResultKind.REGION_CLUSTERS,
      total: 500,
      clusters: [
        { id: 'a', name: '연향동', lat: 34.94, lng: 127.53, count: 412 },
        { id: 'b', name: '덕연동', lat: 34.95, lng: 127.5, count: 88 },
      ],
    });
    expect(toMapMarkers(clusters, { unit: 'pyeong' })).toMatchObject([
      { kind: 'cluster', name: '연향동', count: 412, size: 'md' },
      { kind: 'cluster', name: '덕연동', size: 'sm' },
    ]);
    expect(toMapMarkers(undefined, { unit: 'pyeong' })).toEqual([]);
  });

  it('merges price pills that would overlap on screen into one "+N" pill on the cheapest', () => {
    const pill = (id: string, lng: number, deposit: number, count = 1): MapListingMarker => ({
      type: 'LISTING',
      id,
      lat: 34.97,
      lng,
      dealType: 'MONTHLY',
      deposit,
      monthlyRent: 40,
      salePrice: null,
      count,
    });
    // 100 000 px per degree: 0.0003° apart = 30 px (overlap), 0.002° = 200 px (apart).
    const scale = { lng: 100_000, lat: 100_000 };
    const markers = [pill('a', 127.48, 1000), pill('b', 127.4803, 500, 2), pill('c', 127.482, 300)];
    const groups = groupListingMarkers(markers, scale);
    expect(groups.map((g) => [g.rep.id, g.members.map((m) => m.id), g.count])).toEqual([
      ['c', ['c'], 1],
      ['b', ['b', 'a'], 3],
    ]);
    expect(groups[1]!.area.swLng).toBeLessThan(127.48);
    expect(groups[1]!.area.neLng).toBeGreaterThan(127.4803);
    const drawn = toMapMarkers(
      {
        kind: MapResultKind.MARKERS,
        total: 4,
        truncated: false,
        clusters: [],
        markers,
        summary: null,
      },
      { unit: 'pyeong', groups },
    );
    expect(drawn.map((m) => (m.kind === 'price' ? m.priceLabel : m.id))).toEqual([
      '300/40',
      '500/40 +2',
    ]);
    // Without a scale (not measured yet) every building keeps its own pill.
    expect(groupListingMarkers(markers, null)).toHaveLength(3);
  });

  it('only strips the local district prefix', () => {
    expect(shortComplexName('신대 에듀포레', '신대')).toBe('에듀포레');
    expect(shortComplexName('선월 하이츠 2차', '신대')).toBe('선월 하이츠 2차');
    expect(shortComplexName('신대 A', '신대')).toBe('신대 A');
  });
});

describe('response schemas', () => {
  it('accepts the popular-complex shape of the home page group', () => {
    const [c] = complexListSchema.parse({
      items: [
        {
          id: 'c1',
          name: '신대 레이크파크 1단지',
          dealCounts: { presale: 0, sale: 38, jeonse: 12, monthly: 6 },
          salePriceMin: 39000,
          salePriceMax: 48500,
          latestTrade: { price: 43500, areaLabel: '34평' },
        },
      ],
    });
    expect(c?.counts.sale).toBe(38);
    expect(c?.salePrice).toEqual({ min: 39000, max: 48500 });
    expect(c?.latestTrade?.pyeongLabel).toBe('34');
  });

  it('tolerates unknown values in the assumed enums instead of failing the whole page', () => {
    const page = listingPageSchema.parse({
      items: [
        { id: 'r1', assetType: 'ONEROOM', dealType: 'MONTHLY', roomType: 'TWOROOM' },
        { id: 'l1', assetType: 'LAND', dealType: 'SALE', landZone: '주거', landCategory: 7 },
        { id: 'r2', assetType: 'ONEROOM', dealType: 'MONTHLY', roomType: 'TWO_ROOM' },
      ],
      total: 3,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    expect(page.items.map((l) => [l.roomType, l.landZone, l.landCategory])).toEqual([
      [null, undefined, undefined],
      [undefined, null, null],
      ['TWO_ROOM', undefined, undefined],
    ]);
    const map = mapSearchResponseSchema.parse({
      kind: MapResultKind.MARKERS,
      total: 0,
      summary: { listingCount: 'many', avgDeposit: 500 },
    });
    expect(map.summary).toMatchObject({ listingCount: null, avgDeposit: 500 });
    expect(
      mapSearchResponseSchema.parse({ kind: MapResultKind.MARKERS, total: 0, summary: 'n/a' })
        .summary,
    ).toBeNull();
  });
});

describe('browser storage helpers', () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  };

  it('closes the whole ad slot for the session and survives blocked storage', () => {
    const store = memory();
    expect(isAdSlotClosed(store)).toBe(false);
    closeAdSlot(store);
    expect(isAdSlotClosed(store)).toBe(true);
    expect(isAdSlotClosed(null)).toBe(false);
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined,
    };
    expect(isAdSlotClosed(blocked)).toBe(false);
    expect(() => closeAdSlot(blocked)).not.toThrow();
    expect(nextAdRotation(blocked)).toBe(0);
  });

  it('starts every page view on the next banner of the slot', () => {
    const store = memory();
    const starts = [nextAdRotation(store), nextAdRotation(store), nextAdRotation(store)];
    expect(starts).toEqual([0, 1, 2]);
    store.setItem('house:map-ad-rotation:v1', 'junk');
    expect(nextAdRotation(store)).toBe(0);
    // start 2 of 3 banners → shows #2, then #0, #1 … while the card rotates.
    expect([0, 1, 2, 3].map((step) => rotationIndex(2, step, 3))).toEqual([2, 0, 1, 2]);
    expect(rotationIndex(5, 0, 0)).toBe(0);
  });

  it('keeps recent complexes newest first, deduplicated and capped', () => {
    const row = (id: string): RecentComplex => ({
      id,
      name: id,
      counts: { presale: 0, sale: 0, jeonse: 0, monthly: 0 },
      viewedAt: '2026-11-23T00:00:00Z',
    });
    const list = mergeRecentComplex([row('a'), row('b'), row('c')], row('b'), 3);
    expect(list.map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(mergeRecentComplex(list, row('d'), 3).map((r) => r.id)).toEqual(['d', 'b', 'a']);
  });
});
