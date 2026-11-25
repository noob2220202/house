import type { RegionView } from '@house/shared';
import { seoLandingQuerySchema, seoRegionParamSchema, seoReportQuerySchema } from './dto';
import {
  buildRegionIndex,
  groupByRegion,
  latestReportMonth,
  median,
  regionKeyOf,
  regionNameResolver,
  summarizeDeposits,
  summarizeSales,
  topComplexes,
  tradeWindow,
  type ReportTradeRow,
} from './seo.domain';
import { inRegion } from './services/seo-regions.service';

const region = (
  code: string,
  name: string,
  level: RegionView['level'],
  parentCode: string | null = null,
): RegionView => ({
  code,
  name,
  fullName: name,
  level,
  parentCode,
  lat: 34.9,
  lng: 127.5,
  isActive: true,
});

const REGIONS: RegionView[] = [
  region('12150114', '연향동', 'EMD', '12150'),
  region('1215011400', '연향동', 'EMD', '12150'),
  region('1215031000', '해룡면', 'EMD', '12150'),
  region('1215031022', '신대리', 'RI', '1215031000'),
  region('1215032000', '서면', 'EMD', '12150'),
  region('1215032022', '대구리', 'RI', '1215032000'),
  region('1215035000', '주암면', 'EMD', '12150'),
  region('1215035038', '대구리', 'RI', '1215035000'),
];

describe('seo region helpers', () => {
  it('normalizes region keys (10-digit 읍면동 → 8 digits, 리 stays 10)', () => {
    expect(regionKeyOf('1215011400')).toBe('12150114');
    expect(regionKeyOf('12150114')).toBe('12150114');
    expect(regionKeyOf('1215031022')).toBe('1215031022');
    expect(regionKeyOf('12150')).toBeNull();
    expect(regionKeyOf(null)).toBeNull();
  });

  it('indexes 읍면동 and 리 with 법정동 labels (8-digit row wins)', () => {
    const index = buildRegionIndex(REGIONS);
    expect(index.get('12150114')).toMatchObject({ name: '연향동', emdName: '연향동' });
    expect(index.get('12150310')).toMatchObject({ name: '해룡면', parentName: null });
    expect(index.get('1215031022')).toMatchObject({
      name: '신대리',
      emdName: '해룡면 신대리',
      parentName: '해룡면',
    });
    expect(index.has('1215011400')).toBe(false);
  });

  it('resolves 국토교통부 법정동 names, never guessing an ambiguous 리', () => {
    const resolve = regionNameResolver(buildRegionIndex(REGIONS));
    expect(resolve('연향동')).toBe('12150114');
    expect(resolve('신대리')).toBe('1215031022');
    expect(resolve('해룡면 신대리')).toBe('1215031022');
    expect(resolve('대구리')).toBeNull();
    expect(resolve('서면 대구리')).toBe('1215032022');
    expect(resolve('해룡면 대구리')).toBeNull();
    expect(resolve('없는동')).toBeNull();
    expect(resolve(null)).toBeNull();
  });

  it('matches a 리 inside its 읍·면 landing but not the reverse', () => {
    expect(inRegion('1215031022', '12150310')).toBe(true);
    expect(inRegion('12150310', '12150310')).toBe(true);
    expect(inRegion('12150310', '1215031022')).toBe(false);
    expect(inRegion('12150114', '12150310')).toBe(false);
    expect(inRegion(null, '12150310')).toBe(false);
  });
});

describe('seo statistics', () => {
  it('computes the median of odd / even samples', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 10])).toBe(3);
  });

  it('summarizes 매매 rows (mean, median, range, 전용 평당가) and skips invalid prices', () => {
    const s = summarizeSales([
      { price: 30_000, exclusiveArea: 84.9 },
      { price: 40_000, exclusiveArea: 84.9 },
      { price: 50_000, exclusiveArea: 0 },
      { price: 0, exclusiveArea: 59 },
    ]);
    expect(s).toMatchObject({
      count: 3,
      avgPrice: 40_000,
      medianPrice: 40_000,
      minPrice: 30_000,
      maxPrice: 50_000,
    });
    // (30,000 + 40,000) / 2 / (84.9 / 3.305785) ≈ 1,363 만원/평 — the 0 ㎡ row is skipped.
    expect(s.avgPricePerPyeong).toBe(1363);
    expect(summarizeSales([])).toEqual({
      count: 0,
      avgPrice: null,
      medianPrice: null,
      minPrice: null,
      maxPrice: null,
      avgPricePerPyeong: null,
    });
    expect(summarizeDeposits([20_000, 0, 30_000])).toEqual({
      count: 2,
      avgDeposit: 25_000,
      medianDeposit: 25_000,
    });
  });

  it('uses a 12-month trade window and defaults the report to the last closed month', () => {
    expect(tradeWindow(202611)).toEqual({ fromYm: 202512, toYm: 202611 });
    expect(latestReportMonth([202611, 202610, 202609], 202611)).toBe(202610);
    expect(latestReportMonth([202611], 202611)).toBe(202611);
    expect(latestReportMonth([], 202611)).toBeNull();
  });

  it('groups a month per 법정동 (matched 단지 first) and ranks 단지 by trades', () => {
    const index = buildRegionIndex(REGIONS);
    const resolve = regionNameResolver(index);
    const row = (over: Partial<ReportTradeRow>): ReportTradeRow => ({
      price: 30_000,
      exclusiveArea: 84,
      emdName: '연향동',
      complexRegionKey: null,
      complexId: null,
      complexName: null,
      aptName: 'A',
      ...over,
    });
    const rows = [
      row({ complexRegionKey: '12150114', complexId: 'c1', complexName: '연향 A' }),
      row({ complexRegionKey: '12150114', complexId: 'c1', complexName: '연향 A' }),
      row({ emdName: '신대리', aptName: 'B' }),
      row({ emdName: '대구리', aptName: 'C' }),
    ];
    const groups = groupByRegion(rows, index, resolve);
    expect(groups.map((g) => [g.regionCode, g.name, g.rows.length])).toEqual([
      ['12150114', '연향동', 2],
      ['1215031022', '해룡면 신대리', 1],
      [null, '대구리', 1],
    ]);
    expect(topComplexes(rows, 2)).toEqual([
      { complexId: 'c1', name: '연향 A', emdName: '연향동', prices: [30_000, 30_000] },
      { complexId: null, name: 'B', emdName: '신대리', prices: [30_000] },
    ]);
  });
});

describe('seo dto', () => {
  it('accepts 8/10-digit region keys and canonicalizes legacy codes', () => {
    expect(seoRegionParamSchema.parse({ code: '46150114' }).code).toBe('12150114');
    expect(seoRegionParamSchema.safeParse({ code: '12150' }).success).toBe(false);
  });
  it('parses asset types and report months', () => {
    expect(seoLandingQuerySchema.parse({ assetTypes: 'APT,OFFICETEL' }).assetTypes).toEqual([
      'APT',
      'OFFICETEL',
    ]);
    expect(seoLandingQuerySchema.safeParse({ assetTypes: 'CASTLE' }).success).toBe(false);
    expect(seoReportQuerySchema.parse({ ym: '202610' }).ym).toBe(202610);
    expect(seoReportQuerySchema.safeParse({ ym: '202613' }).success).toBe(false);
    expect(seoReportQuerySchema.parse({}).ym).toBeUndefined();
  });
});
