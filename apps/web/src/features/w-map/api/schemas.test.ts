import type { MapSearchResult } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { complexListSchema, mapSearchResponseSchema, regionListSchema } from './schemas';

const base = {
  zoom: 17,
  bbox: { swLng: 127.5, swLat: 34.9, neLng: 127.6, neLat: 35 },
  truncated: false,
};

describe('mapSearchResponseSchema (backend MapSearchResult)', () => {
  it('maps clusters by key', () => {
    const wire: MapSearchResult = {
      ...base,
      kind: 'REGION_CLUSTERS',
      total: 12,
      clusters: [
        {
          key: '12150120',
          regionCode: '12150120',
          name: '조례동',
          lat: 34.96,
          lng: 127.53,
          count: 12,
          byDealType: {},
        },
      ],
      complexes: [],
      listings: [],
    };
    const res = mapSearchResponseSchema.parse(wire);
    expect(res.clusters[0]).toMatchObject({ id: '12150120', name: '조례동', count: 12 });
    expect(res.markers).toEqual([]);
    expect(res.summary).toBeUndefined();
  });

  it('turns complex markers and per-listing markers into the map markers', () => {
    const wire: MapSearchResult = {
      ...base,
      kind: 'MARKERS',
      total: 5,
      clusters: [],
      complexes: [
        {
          complexId: 'C01',
          name: '신대 레이크파크',
          assetType: 'APT',
          lat: 34.93,
          lng: 127.55,
          households: 1412,
          builtYear: 2019,
          count: 3,
          byDealType: {
            SALE: { count: 2, priceMin: 42000, priceMax: 48500 },
            JEONSE: { count: 1, priceMin: 26000, priceMax: 26000 },
          },
        },
      ],
      listings: [
        // Two rooms of one building + one elsewhere.
        {
          id: 'R1',
          dealType: 'MONTHLY',
          assetType: 'ONEROOM',
          lat: 34.97,
          lng: 127.48,
          salePrice: null,
          deposit: 500,
          monthlyRent: 42,
          presalePrice: null,
          premium: null,
          priceSort: 500,
          exclusiveArea: 23,
          floorClass: null,
          rooms: 1,
        },
        {
          id: 'R2',
          dealType: 'MONTHLY',
          assetType: 'ONEROOM',
          lat: 34.97,
          lng: 127.48,
          salePrice: null,
          deposit: 300,
          monthlyRent: 45,
          presalePrice: null,
          premium: null,
          priceSort: 300,
          exclusiveArea: 20,
          floorClass: null,
          rooms: 1,
        },
        {
          id: 'R3',
          dealType: 'JEONSE',
          assetType: 'ONEROOM',
          lat: 34.95,
          lng: 127.49,
          salePrice: null,
          deposit: 9000,
          monthlyRent: null,
          presalePrice: null,
          premium: null,
          priceSort: 9000,
          exclusiveArea: 30,
          floorClass: null,
          rooms: 2,
        },
      ],
    };
    const res = mapSearchResponseSchema.parse(wire);
    const complex = res.markers.find((m) => m.type === 'COMPLEX');
    expect(complex).toMatchObject({
      id: 'C01',
      count: 3,
      counts: { presale: 0, sale: 2, jeonse: 1, monthly: 0 },
      salePrice: { min: 42000, max: 48500 },
      representative: { price: 42000, dealType: 'SALE' },
    });
    const pins = res.markers.filter((m) => m.type === 'LISTING');
    expect(pins).toHaveLength(2);
    expect(pins.find((m) => m.count === 2)).toMatchObject({ id: 'R2', deposit: 300 });
  });
});

describe('complex rows', () => {
  it('reads popular (listingCounts) and favourite ({ complex }) rows', () => {
    const [popular] = complexListSchema.parse([
      {
        id: 'C1',
        name: 'A',
        assetType: 'APT',
        lat: 1,
        lng: 2,
        listingCounts: { total: 3, byDealType: { SALE: 2, MONTHLY: 1 } },
      },
    ]);
    expect(popular?.counts).toEqual({ presale: 0, sale: 2, jeonse: 0, monthly: 1 });
    const [fav] = complexListSchema.parse({
      items: [
        {
          favoritedAt: '2026-11-01',
          complex: { id: 'C2', name: 'B', assetType: 'APT', lat: 1, lng: 2 },
        },
      ],
    });
    expect(fav).toMatchObject({ id: 'C2', name: 'B' });
  });

  it('keeps only regions with coordinates (RegionView lat/lng are nullable)', () => {
    const regions = regionListSchema.parse([
      {
        code: '12150120',
        name: '조례동',
        fullName: '순천시 조례동',
        level: 'EMD',
        parentCode: '12150',
        lat: 34.96,
        lng: 127.53,
        isActive: true,
      },
      {
        code: '12150250',
        name: '주암면',
        fullName: '순천시 주암면',
        level: 'EMD',
        parentCode: '12150',
        lat: null,
        lng: null,
        isActive: true,
      },
    ]);
    expect(regions.map((r) => r.name)).toEqual(['조례동']);
  });
});
