import { agencySearchQuerySchema, listingListQuerySchema } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { toQueryString } from '@/lib/api/config';
import { STATIC_MAP_BOUNDS } from '@/lib/map/geo';
import { defaultFilters, parseFilters } from '@/lib/map/url-state';
import { agencyListingsQuery } from '../api/queries';
import {
  AGENCY_FILTERS,
  agencySortOf,
  resultCaption,
  specialtyOption,
  toAgencyQuery,
} from '../lib/filters';
import {
  boundsToQueryBbox,
  clampCenter,
  currentMapBounds,
  isNearSuncheon,
  panTarget,
  scaleBar,
} from '../lib/geo';
import { maxListingPage, parseListingParams, serializeListingParams } from '../lib/listing-params';

const parse = (qs: string) => parseFilters(AGENCY_FILTERS, new URLSearchParams(qs));

describe('toAgencyQuery', () => {
  it('sends the default sort and the page size for the default filters', () => {
    const query = toAgencyQuery(defaultFilters(AGENCY_FILTERS), { pageSize: 20 });
    expect(toQueryString(query)).toBe('?sort=LISTINGS&pageSize=20');
  });

  it('maps URL filters to the API params', () => {
    const query = toAgencyQuery(
      parse('q=%20호수%20&spec=ONEROOM&emd=12150127&open=1&presale=1&sort=NAME'),
      { page: 2, pageSize: 20 },
    );
    expect(query).toMatchObject({
      q: '호수',
      specialties: ['ONEROOM', 'OFFICETEL'],
      emdCode: '12150127',
      openNow: true,
      handlesPresale: true,
      sort: 'NAME',
      page: 2,
    });
  });

  it('sends openNow / handlesPresale only when those toggles are on', () => {
    const query = toAgencyQuery(parse('q=호수&sort=NAME'));
    expect(query.q).toBe('호수');
    expect(query.openNow).toBeUndefined();
    expect(query.handlesPresale).toBeUndefined();
    expect(toQueryString(toAgencyQuery(parse('open=1&presale=1')))).toBe(
      '?openNow=true&handlesPresale=true&sort=LISTINGS',
    );
  });

  it('produces a query the backend schema accepts', () => {
    const bbox = boundsToQueryBbox({ swLat: 34.9, swLng: 127.46, neLat: 34.99, neLng: 127.6 });
    const query = toAgencyQuery(parse('q=호수&spec=APT&emd=12150127&open=1&presale=1'), {
      bbox,
      pageSize: 100,
    });
    const sp = Object.fromEntries(new URLSearchParams(toQueryString(query).slice(1)));
    const parsed = agencySearchQuerySchema.safeParse(sp);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      q: '호수',
      specialties: ['APT'],
      openNow: true,
      handlesPresale: true,
      pageSize: 100,
      sort: 'LISTINGS',
    });
    for (const sort of ['RECENT', 'NAME', 'LISTINGS']) {
      const q = toAgencyQuery(parse(`sort=${sort}`));
      const ok = agencySearchQuerySchema.safeParse({ sort: q.sort });
      expect(ok.success, sort).toBe(true);
    }
    expect(parsed.data?.bbox).toEqual({ swLng: 127.46, swLat: 34.9, neLng: 127.6, neLat: 34.99 });
  });

  it('ignores unknown specialties, sorts and malformed areas from the URL', () => {
    const query = toAgencyQuery(parse('spec=CASTLE&sort=RANDOM&area=1,2,drop%20table'));
    expect(query.specialties).toEqual([]);
    expect(query.sort).toBe('LISTINGS');
    expect(query.bbox).toBeUndefined();
    expect(specialtyOption('CASTLE').value).toBe('');
    expect(agencySortOf(null)).toBe('LISTINGS');
    expect(agencySortOf('RECENT')).toBe('NEWEST');
  });

  it('prefers the viewport bbox (map) over the saved search area (list)', () => {
    const filters = parse('area=127.5,34.9,127.6,35');
    expect(toAgencyQuery(filters).bbox).toBe('127.5,34.9,127.6,35');
    expect(toAgencyQuery(filters, { bbox: '1,2,3,4' }).bbox).toBe('1,2,3,4');
  });
});

describe('resultCaption', () => {
  it('describes what the count refers to', () => {
    expect(resultCaption(parse(''))).toBe('전체');
    expect(resultCaption(parse('spec=APT'))).toBe('아파트 전문');
    expect(resultCaption(parse('q=호수'))).toBe('검색 결과');
    expect(resultCaption(parse('open=1'))).toBe('검색 결과');
    expect(resultCaption(parse('presale=1'))).toBe('검색 결과');
    expect(resultCaption(parse('sort=NAME'))).toBe('전체');
  });
});

describe('map geometry', () => {
  const bounds = { swLat: 34.9, swLng: 127.5, neLat: 35.0, neLng: 127.6 };

  it('rounds and clamps the bbox to what the backend allows', () => {
    expect(
      boundsToQueryBbox({ swLat: 34.90001, swLng: 127.46004, neLat: 34.98996, neLng: 127.6 }),
    ).toBe('127.460000,34.900000,127.600000,34.990000');
    const [swLng, swLat, neLng, neLat] = boundsToQueryBbox({
      swLat: 30,
      swLng: 120,
      neLat: 40,
      neLng: 135,
    })
      .split(',')
      .map(Number) as [number, number, number, number];
    expect(neLng - swLng).toBeLessThanOrEqual(2);
    expect(neLat - swLat).toBeLessThanOrEqual(2);
    expect((swLng + neLng) / 2).toBeCloseTo(127.5);
  });

  it('does not pan when the target is comfortably visible', () => {
    expect(panTarget({ lat: 34.95, lng: 127.55 }, bounds)).toBeNull();
  });

  it('pans when the target is outside or under the drawer', () => {
    // Outside the viewport → centre on it.
    expect(panTarget({ lat: 34.95, lng: 127.7 }, bounds)).toEqual({ lat: 34.95, lng: 127.7 });
    // Visible in the full map but hidden under a drawer covering the right 40 %.
    const target = { lat: 34.95, lng: 127.58 };
    expect(panTarget(target, bounds)).toBeNull();
    const center = panTarget(target, bounds, 0.4);
    expect(center?.lng).toBeCloseTo(127.6); // target lands in the middle of the free 60 %
    expect(center?.lat).toBe(34.95);
  });

  it('keeps the fallback map inside its art', () => {
    const view = { swLat: 34.92, swLng: 127.5, neLat: 34.96, neLng: 127.58 }; // 0.08° × 0.04°
    const clamped = clampCenter({ lat: 35.5, lng: 128 }, view, STATIC_MAP_BOUNDS);
    expect(clamped.lng).toBeCloseTo(STATIC_MAP_BOUNDS.neLng - 0.04);
    expect(clamped.lat).toBeCloseTo(STATIC_MAP_BOUNDS.neLat - 0.02);
    // May overshoot the east edge by the part hidden under the drawer.
    expect(clampCenter({ lat: 34.95, lng: 128 }, view, STATIC_MAP_BOUNDS, 0.5).lng).toBeCloseTo(
      STATIC_MAP_BOUNDS.neLng,
    );
    // A viewport larger than the art is centred.
    const huge = { swLat: 34, swLng: 127, neLat: 36, neLng: 128 };
    expect(clampCenter({ lat: 0, lng: 0 }, huge, STATIC_MAP_BOUNDS).lng).toBeCloseTo(
      (STATIC_MAP_BOUNDS.swLng + STATIC_MAP_BOUNDS.neLng) / 2,
    );
  });

  it('picks a round scale distance that fits', () => {
    // 0.14° of longitude ≈ 12.8 km over 1280 px → 10 m/px → 500 m = 50 px.
    const bar = scaleBar({ swLat: 34.9, swLng: 127.46, neLat: 35, neLng: 127.6 }, 1280);
    expect(bar?.label).toBe('500m');
    expect(bar?.width).toBeGreaterThan(40);
    expect(bar?.width).toBeLessThanOrEqual(72);
    expect(scaleBar({ swLat: 34, swLng: 127, neLat: 36, neLng: 129 }, 400)?.label).toBe('20km');
    expect(scaleBar(bounds, 0)).toBeNull();
  });

  it('follows the controlled view on the fallback map (zoom buttons, cluster, 지역)', () => {
    const size = { width: 800, height: 600 };
    const center = { lat: 34.9475, lng: 127.5454 };
    const z13 = currentMapBounds('static', { center, zoom: 13 }, size, null);
    const z15 = currentMapBounds('static', { center, zoom: 15 }, size, z13);
    expect(z13 && z15).toBeTruthy();
    // Zooming in 2 levels shrinks the visible span ≈4× → the marker query / 다시 검색 bbox changes.
    const span = (b: NonNullable<typeof z13>) => b.neLng - b.swLng;
    expect(span(z15!) / span(z13!)).toBeCloseTo(0.25, 2);
    expect(boundsToQueryBbox(z15!)).not.toBe(boundsToQueryBbox(z13!));
    // Panning moves it too, even though the map itself did not report anything.
    const panned = currentMapBounds(
      'static',
      { center: { ...center, lng: 127.56 }, zoom: 13 },
      size,
      z13,
    );
    expect(panned!.swLng).toBeGreaterThan(z13!.swLng);
    // Unknown size → no query yet; the Naver map keeps using what it reported.
    expect(
      currentMapBounds('static', { center, zoom: 13 }, { width: 0, height: 0 }, null),
    ).toBeNull();
    expect(currentMapBounds('naver', { center, zoom: 15 }, size, z13)).toBe(z13);
  });

  it('knows the service area', () => {
    expect(isNearSuncheon({ lat: 34.95, lng: 127.49 })).toBe(true);
    expect(isNearSuncheon({ lat: 37.57, lng: 126.98 })).toBe(false);
  });
});

describe('agency listing params', () => {
  it('round-trips through the query string and drops defaults', () => {
    const params = parseListingParams(
      new URLSearchParams('type=APT&deal=JEONSE&sort=PRICE_ASC&page=3'),
    );
    expect(params).toEqual({ assetType: 'APT', dealType: 'JEONSE', sort: 'PRICE_ASC', page: 3 });
    expect(serializeListingParams(params).toString()).toBe(
      'type=APT&deal=JEONSE&sort=PRICE_ASC&page=3',
    );
    expect(serializeListingParams(parseListingParams(new URLSearchParams(''))).toString()).toBe('');
  });
  it('falls back on invalid values and keeps unrelated params', () => {
    expect(parseListingParams(new URLSearchParams('type=CASTLE&deal=x&sort=y&page=-2'))).toEqual({
      assetType: null,
      dealType: null,
      sort: 'LATEST',
      page: 1,
    });
    const sp = serializeListingParams(
      { assetType: null, dealType: 'SALE', sort: 'LATEST', page: 1 },
      new URLSearchParams('utm=x&type=APT&page=4'),
    );
    expect(sp.toString()).toBe('utm=x&deal=SALE');
  });
  it('builds the API query (CSV arrays, defaults omitted)', () => {
    expect(
      toQueryString(
        agencyListingsQuery('a1', { assetType: 'APT', dealType: 'SALE', sort: 'LATEST', page: 1 }),
      ),
    ).toBe('?agencyId=a1&assetTypes=APT&dealTypes=SALE&pageSize=12');
    expect(toQueryString(agencyListingsQuery('a1', { sort: 'PRICE_DESC', page: 2 }))).toBe(
      '?agencyId=a1&sort=PRICE_DESC&page=2&pageSize=12',
    );
  });
  it('produces a query the shared listing list schema accepts', () => {
    const id = '0b6f2c1e-0000-4000-8000-0000000000b1';
    const qs = toQueryString(
      agencyListingsQuery(id, { assetType: 'APT', dealType: 'JEONSE', sort: 'PRICE_ASC', page: 2 }),
    );
    const parsed = listingListQuerySchema.safeParse(
      Object.fromEntries(new URLSearchParams(qs.slice(1))),
    );
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      agencyId: id,
      assetTypes: ['APT'],
      dealTypes: ['JEONSE'],
      sort: 'PRICE_ASC',
      page: 2,
      pageSize: 12,
    });
  });
  it('bounds the page by the office counters', () => {
    const counts = {
      activeListingCount: 46,
      listingCounts: { presale: 0, sale: 20, jeonse: 14, monthly: 12 },
      listingCountsByAsset: { APT: 30, ONEROOM: 16 },
    };
    const all = { assetType: null, dealType: null };
    expect(maxListingPage(counts, all, 12)).toBe(4);
    expect(maxListingPage(counts, { assetType: 'APT', dealType: null }, 12)).toBe(3);
    expect(maxListingPage(counts, { assetType: 'APT', dealType: 'MONTHLY' }, 12)).toBe(1);
    expect(maxListingPage(counts, { assetType: 'LAND', dealType: null }, 12)).toBe(1);
    expect(maxListingPage(counts, { assetType: null, dealType: 'PRESALE' }, 12)).toBe(1);
  });
});
