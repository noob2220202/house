import { describe, expect, it } from 'vitest';
import { popularComplexSchema, popularRegionSchema } from '../api/schemas';
import { complexRankRow, rankStatusLabel, regionRankRow } from './ranking';

const NOW = new Date('2026-11-23T12:00:00+09:00');

describe('complexRankRow', () => {
  const first = popularComplexSchema.parse({
    id: 'c1',
    name: '신대 레이크파크 1단지',
    emdName: '해룡면 신대리',
    lat: 34.9335,
    lng: 127.556,
    households: 1412,
    builtYear: 2019,
    rank: 1,
    rankDelta: 0,
    rankStreakWeeks: 3,
    weeklyViewCount: 2418,
    dealCounts: { presale: 0, sale: 38, jeonse: 12, monthly: 6 },
    activeListingCount: 56,
    salePriceMin: 39000,
    salePriceMax: 48500,
    representativeAreaLabel: '34평',
    pricePerPyeong: 1180,
    latestTrade: { price: 43500, areaLabel: '34평', note: null },
  });

  it('builds the #1 feature card texts', () => {
    const row = complexRankRow(first, 0, NOW);
    expect(row.rank).toBe(1);
    expect(row.delta).toBe(0);
    expect(row.href).toBe('/complex/c1');
    expect(row.total).toBe(56);
    expect(row.feature).toMatchObject({
      kicker: '3주 연속 1위',
      weeklyViews: 2418,
      meta: '해룡면 신대리 · 1,412세대 · 2019년 준공',
      priceCaption: '34평 매매 호가',
      priceText: '3억 9,000 ~ 4억 8,500',
      mobilePriceLabel: '매매',
      mobilePriceText: '3억 9,000 ~',
      statusLabel: '순위 유지',
      ctaLabel: '매물 56건 보기',
    });
    expect(row.feature.ctaHref).toBe('/map/apt?c=34.9335%2C127.556&z=17&complex=c1');
    expect(row.mobileCaption).toBe('해룡면 신대리 · 1,180만/평');
    expect(row.value).toEqual({ main: '4억 3,500', caption: '34평' });
  });

  it('marks new entries and presale-only complexes', () => {
    const row = complexRankRow(
      popularComplexSchema.parse({
        id: 'c9',
        name: '연향들 더 퍼스트',
        emdName: '연향동',
        households: 612,
        builtYear: 2029,
        rankDelta: null,
        dealCounts: { presale: 58 },
        latestTrade: { price: 42800, areaLabel: '34평', note: '분양가' },
      }),
      8,
      NOW,
    );
    expect(row.rank).toBe(9);
    expect(row.delta).toBe('new');
    expect(row.total).toBe(58);
    expect(row.counts).toEqual({ presale: 58, sale: 0, jeonse: 0, monthly: 0 });
    expect(row.value).toEqual({ main: '4억 2,800', caption: '34평 분양가' });
    expect(row.feature.meta).toBe('연향동 · 612세대 · 2029년 입주 예정');
    expect(row.feature.priceCaption).toBe('34평 분양가');
    expect(row.feature.priceText).toBe('4억 2,800');
    expect(row.feature.kicker).toBeUndefined();
    expect(row.feature.statusLabel).toBe('새로 진입');
  });

  it('survives a minimal payload', () => {
    const row = complexRankRow(popularComplexSchema.parse({ id: 'x', name: '이름만' }), 2, NOW);
    expect(row).toMatchObject({ rank: 3, delta: 0, place: '', total: 0, value: undefined });
    expect(row.feature.priceText).toBe('매물 문의');
    expect(row.feature.ctaHref).toBe('/map/apt?complex=x');
  });
});

describe('regionRankRow', () => {
  it('links to the map of the category centred on the district', () => {
    const row = regionRankRow(
      popularRegionSchema.parse({
        code: '1215011500',
        name: '석현동',
        emdName: '석현동',
        lat: 34.969,
        lng: 127.483,
        listingCount: 86,
        dealCounts: { presale: 0, sale: 8, jeonse: 14, monthly: 64 },
        avgPricePerPyeong: 780,
        rankDelta: 2,
      }),
      0,
      'oneroom',
    );
    expect(row.href).toBe('/map/oneroom?c=34.969%2C127.483&z=15');
    expect(row.delta).toBe(2);
    expect(row.place).toBe('순천시');
    expect(row.placeExtra).toBe('매물 86건');
    expect(row.value).toEqual({ main: '780만/평' });
    expect(row.feature.ctaLabel).toBe('매물 86건 보기');
    expect(row.feature.statusLabel).toBe('2계단 상승');
  });

  it('shows the 법정동 under a 지구 name and copes without a 평당가', () => {
    const row = regionRankRow(
      popularRegionSchema.parse({
        code: '1',
        name: '신대지구',
        emdName: '해룡면 신대리',
        lat: 34.93,
        lng: 127.55,
        listingCount: 18,
        avgPricePerPyeong: null,
        rankDelta: -1,
      }),
      3,
      'land',
    );
    expect(row.rank).toBe(4);
    expect(row.place).toBe('해룡면 신대리');
    expect(row.value).toBeUndefined();
    expect(row.mobileCaption).toBe('해룡면 신대리 · 매물 18건');
    expect(row.feature.priceText).toBe('18건');
  });
});

describe('rankStatusLabel', () => {
  it('describes the movement', () => {
    expect(rankStatusLabel(0)).toBe('순위 유지');
    expect(rankStatusLabel(2)).toBe('2계단 상승');
    expect(rankStatusLabel(-1)).toBe('1계단 하락');
    expect(rankStatusLabel('new')).toBe('새로 진입');
  });
});
