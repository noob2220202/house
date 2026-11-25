import { AssetType } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { ASSETS } from '@/features/w-map/config/assets';
import { buildLlmsFullTxt, buildLlmsTxt } from './llms';
import { absoluteUrl } from './metadata';
import {
  LANDING_ASSETS,
  LANDING_ASSET_SLUGS,
  SEO_ROUTES,
  assetSlugOf,
  districtAlias,
  findRegionBySlug,
  placeLabel,
  indexableLandings,
  landingDecision,
  landingTitle,
  regionSlug,
} from './regions';
import type { SeoRegion, SeoRegionIndex, SeoTradeReport } from './schemas';
import {
  newestOf,
  regionEntries,
  reportEntries,
  rowEntries,
  sitemapIndexXml,
  staticEntries,
} from './sitemap';

const counts = (over: Partial<Record<AssetType, number>> = {}) => ({
  APT: 0,
  OFFICETEL: 0,
  ONEROOM: 0,
  HOUSE: 0,
  COMMERCIAL: 0,
  LAND: 0,
  ...over,
});

const region = (over: Partial<SeoRegion> & Pick<SeoRegion, 'code' | 'name'>): SeoRegion => ({
  emdName: over.name,
  parentName: null,
  lat: 34.95,
  lng: 127.5,
  listingCounts: counts(),
  complexCount: 0,
  saleTradeCount: 0,
  lastModified: '2026-11-23T00:00:00.000Z',
  ...over,
});

const HAERYONG = region({
  code: '12150370',
  name: '해룡면',
  listingCounts: counts({ APT: 35, COMMERCIAL: 5 }),
  complexCount: 2,
  saleTradeCount: 108,
});
const SINDAE = region({
  code: '1215037021',
  name: '신대리',
  emdName: '해룡면 신대리',
  parentName: '해룡면',
  listingCounts: counts({ APT: 35, COMMERCIAL: 5 }),
  complexCount: 2,
  saleTradeCount: 108,
});
const YEONHYANG = region({
  code: '12150114',
  name: '연향동',
  listingCounts: counts({ APT: 1, OFFICETEL: 1, ONEROOM: 8, LAND: 1 }),
  complexCount: 2,
  saleTradeCount: 53,
});
const WANGJI = region({ code: '12150118', name: '왕지동', listingCounts: counts({ HOUSE: 2 }) });
const REGIONS = [YEONHYANG, WANGJI, HAERYONG, SINDAE];

describe('landing config', () => {
  it('uses the same asset types as the map pages of the same slug', () => {
    for (const slug of LANDING_ASSET_SLUGS) {
      expect([...LANDING_ASSETS[slug].assetTypes]).toEqual([...ASSETS[slug].assetTypes]);
    }
    expect(assetSlugOf(AssetType.OFFICETEL)).toBe('apt');
    expect(assetSlugOf(AssetType.LAND)).toBe('land');
  });

  it('builds readable Korean slugs and resolves encoded params', () => {
    expect(regionSlug(SINDAE)).toBe('해룡면-신대리');
    expect(SEO_ROUTES.region(SINDAE, 'apt')).toBe(
      `/suncheon/${encodeURIComponent('해룡면-신대리')}/apt`,
    );
    expect(decodeURIComponent(SEO_ROUTES.region(SINDAE, 'apt'))).toBe(
      '/suncheon/해룡면-신대리/apt',
    );
    expect(findRegionBySlug(REGIONS, encodeURIComponent('해룡면-신대리'))).toBe(SINDAE);
    expect(findRegionBySlug(REGIONS, '연향동')).toBe(YEONHYANG);
    expect(findRegionBySlug(REGIONS, '없는동')).toBeUndefined();
  });

  it('titles landing pages with the 지구 alias when there is one', () => {
    expect(landingTitle(SINDAE, 'apt')).toBe('순천 신대지구 아파트 매매·전세 시세');
    expect(landingTitle(YEONHYANG, 'oneroom')).toBe('순천 연향동 원룸·투룸 월세·전세 매물');
  });
});

describe('landingDecision (no thin / duplicate pages)', () => {
  it('404s without data and indexes enough data', () => {
    expect(landingDecision(REGIONS, WANGJI, 'apt')).toEqual({ kind: 'empty' });
    expect(landingDecision(REGIONS, YEONHYANG, 'oneroom')).toEqual({ kind: 'index' });
    // 2 아파트 listings, but 2 단지 with 53 실거래 → useful.
    expect(landingDecision(REGIONS, YEONHYANG, 'apt')).toEqual({ kind: 'index' });
  });
  it('keeps thin pages out of the index', () => {
    expect(landingDecision(REGIONS, WANGJI, 'house')).toEqual({ kind: 'thin' });
    expect(landingDecision(REGIONS, YEONHYANG, 'land')).toEqual({ kind: 'thin' });
  });
  it('canonicalizes an 읍·면 whose data all comes from one 리', () => {
    expect(landingDecision(REGIONS, HAERYONG, 'apt')).toEqual({
      kind: 'duplicate',
      canonical: SINDAE,
    });
    expect(landingDecision(REGIONS, SINDAE, 'apt')).toEqual({ kind: 'index' });
    const withOther = region({ ...HAERYONG, listingCounts: counts({ APT: 46 }) });
    expect(landingDecision([withOther, SINDAE], withOther, 'apt')).toEqual({ kind: 'index' });
  });
  it('lists only indexable landings', () => {
    const keys = indexableLandings(REGIONS).map((l) => `${l.region.code}/${l.asset}`);
    expect(keys).toEqual([
      '12150114/apt',
      '12150114/oneroom',
      '1215037021/apt',
      '1215037021/commercial',
    ]);
  });
});

const INDEX: SeoRegionIndex = {
  sggCode: '12150',
  regionName: '순천시',
  tradePeriod: { fromYm: 202512, toYm: 202611 },
  regions: REGIONS,
  updatedAt: '2026-11-24T00:00:00.000Z',
};

const SUMMARY = {
  count: 41,
  avgPrice: 29_495,
  medianPrice: 28_950,
  minPrice: 6_300,
  maxPrice: 61_200,
  avgPricePerPyeong: 1_174,
};
const REPORT: SeoTradeReport = {
  sggCode: '12150',
  regionName: '순천시',
  yearMonth: 202610,
  latestYearMonth: 202610,
  availableMonths: [202611, 202610, 202609],
  sale: { ...SUMMARY, cancelledCount: 1 },
  jeonse: { count: 14, avgDeposit: 22_064, medianDeposit: 21_050 },
  previous: { yearMonth: 202609, sale: { ...SUMMARY, count: 27 } },
  yearAgo: null,
  byRegion: [{ regionCode: '1215037021', name: '해룡면 신대리', sale: { ...SUMMARY, count: 14 } }],
  topComplexes: [],
  syncedAt: null,
  updatedAt: '2026-11-24T00:00:00.000Z',
};

describe('sitemaps', () => {
  it('writes a sitemap index with escaped locations and lastmod', () => {
    const xml = sitemapIndexXml([
      { path: '/sitemaps/static/sitemap.xml', lastModified: new Date('2026-11-23T00:00:00Z') },
      { path: '/sitemaps/regions/sitemap.xml?a=1&b=2', lastModified: null },
    ]);
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<sitemapindex /);
    expect(xml).toContain(`<loc>${absoluteUrl('/sitemaps/static/sitemap.xml')}</loc>`);
    expect(xml).toContain('<lastmod>2026-11-23T00:00:00.000Z</lastmod>');
    expect(xml).toContain('a=1&amp;b=2');
    expect(xml.match(/<lastmod>/g)).toHaveLength(1);
  });

  it('lists static pages, the report months and indexable landings only', () => {
    const urls = staticEntries(['/terms/service']).map((e) => e.url);
    expect(urls).toContain(absoluteUrl('/'));
    expect(urls).toContain(absoluteUrl('/suncheon'));
    expect(urls).toContain(absoluteUrl('/about'));
    expect(urls).toContain(absoluteUrl('/terms/service'));
    expect(reportEntries(REPORT).map((e) => e.url)).toEqual([
      absoluteUrl('/reports/suncheon-apartment-trades'),
      absoluteUrl('/reports/suncheon-apartment-trades/202611'),
      absoluteUrl('/reports/suncheon-apartment-trades/202609'),
    ]);
    expect(reportEntries(null)).toEqual([]);
    const regions = regionEntries(INDEX).map((e) => e.url);
    expect(regions).toHaveLength(4);
    expect(regions).toContain(absoluteUrl('/suncheon/해룡면-신대리/apt'));
    expect(regions).not.toContain(absoluteUrl('/suncheon/해룡면/apt'));
  });

  it('maps API rows with lastmod and finds the newest', () => {
    const entries = rowEntries(
      {
        kind: 'complexes',
        truncated: false,
        items: [
          { id: 'a', lastModified: '2026-11-01T00:00:00Z' },
          { id: 'b', lastModified: 'not a date' },
        ],
      },
      (id) => `/complex/${id}`,
      { changeFrequency: 'daily', priority: 0.8 },
    );
    expect(entries[0]).toMatchObject({ url: absoluteUrl('/complex/a'), priority: 0.8 });
    expect(entries[1]?.lastModified).toBeUndefined();
    expect(newestOf(entries)?.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(newestOf([])).toBeNull();
  });
});

describe('llms.txt', () => {
  it('describes the service, sources and URL patterns without inventing numbers', () => {
    const txt = buildLlmsTxt({ index: null, report: null });
    expect(txt.startsWith(`# `)).toBe(true);
    expect(txt).toContain('## 데이터 출처와 갱신 주기');
    expect(txt).toContain('국토교통부');
    expect(txt).toContain(absoluteUrl('/reports/suncheon-apartment-trades'));
    expect(txt).toContain('/suncheon/{읍면동}/{매물 종류}');
    expect(txt).not.toMatch(/고객센터:/);
  });
  it('adds the latest report and the landing list to llms-full.txt', () => {
    const txt = buildLlmsFullTxt({
      index: INDEX,
      report: REPORT,
      contact: { phone: '061-000-0000', email: null },
      now: new Date('2026-11-24T00:00:00Z'),
    });
    expect(txt).toContain('## 2026년 10월 순천시 아파트 매매 실거래 요약');
    expect(txt).toContain('- 거래량: 41건 (해제 거래 1건 제외)');
    expect(txt).toContain('중위 거래가: 2억 8,950만 원');
    expect(txt).toContain('순천 신대지구 아파트 매매·전세 시세');
    expect(txt).toContain('고객센터: 061-000-0000');
    expect(txt).not.toContain(`/suncheon/${encodeURIComponent('해룡면')}/apt`);
    expect(txt).toContain(`/suncheon/${encodeURIComponent('해룡면-신대리')}/apt`);
  });
});

describe('districtAlias', () => {
  it('names the 택지지구 by its 법정 리, whatever code the region carries', () => {
    expect(districtAlias('해룡면 신대리')).toBe('신대지구');
    expect(districtAlias('신대리')).toBe('신대지구');
    expect(districtAlias(' 해룡면  선월리 ')).toBe('선월지구');
    expect(placeLabel({ code: '1215031022', emdName: '해룡면 신대리' })).toBe('신대지구');
  });

  it('never aliases another 리 (외서면 신덕리 once carried the 신대리 code)', () => {
    expect(districtAlias('외서면 신덕리')).toBeUndefined();
    expect(placeLabel({ code: '1215037021', emdName: '외서면 신덕리' })).toBe('외서면 신덕리');
    expect(districtAlias(null)).toBeUndefined();
  });
});
