import { AssetType, DealType, ListingSort, MAP_ZOOM, MapResultKind } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { listingPageSchema, mapSearchResponseSchema } from '@/features/w-map/api/schemas';
import { APT_LISTINGS, LISTINGS, REGIONS, ROOM_LISTINGS, headlinePrice } from './_fixtures';
import { matchesFilter, searchMap, sortListings, sortPrice } from './_search';

const CITY = { swLng: 127.46, swLat: 34.905, neLng: 127.6, neLat: 34.99 };

describe('map mock fixtures', () => {
  it('cover every asset type with unique ids and coordinates inside the city', () => {
    const ids = new Set(LISTINGS.map((l) => l.id));
    expect(ids.size).toBe(LISTINGS.length);
    for (const type of [
      AssetType.APT,
      AssetType.ONEROOM,
      AssetType.HOUSE,
      AssetType.COMMERCIAL,
      AssetType.LAND,
    ]) {
      expect(LISTINGS.some((l) => l.assetType === type)).toBe(true);
    }
    for (const l of LISTINGS) {
      expect(l.lat).toBeGreaterThan(CITY.swLat);
      expect(l.lat).toBeLessThan(CITY.neLat);
      expect(l.lng).toBeGreaterThan(CITY.swLng);
      expect(l.lng).toBeLessThan(CITY.neLng);
      expect(REGIONS.some((r) => r.code === l.emdCode)).toBe(true);
    }
  });

  it('match the response schema the client parses with', () => {
    const page = {
      items: LISTINGS.slice(0, 50),
      page: 1,
      pageSize: 50,
      total: LISTINGS.length,
      totalPages: 9,
    };
    expect(listingPageSchema.safeParse(page).success).toBe(true);
    const res = searchMap(LISTINGS, CITY, 17, { assetTypes: [AssetType.APT] });
    expect(mapSearchResponseSchema.safeParse(res).success).toBe(true);
  });

  it('keep the pinned mockdata rows (R01 석현동 해오름빌 투룸 500/42)', () => {
    const r01 = ROOM_LISTINGS.find((l) => l.buildingName === '해오름빌' && l.monthlyRent === 42);
    expect(r01).toMatchObject({
      dealType: 'MONTHLY',
      deposit: 500,
      roomType: 'TWO_ROOM',
      floor: 3,
    });
    expect(r01?.sameBuildingCount).toBe(3);
  });
});

describe('map search mock', () => {
  it('switches result kind by zoom band', () => {
    const f = { assetTypes: [AssetType.APT] };
    const region = searchMap(LISTINGS, CITY, MAP_ZOOM.REGION_MAX, f);
    expect(region.kind).toBe(MapResultKind.REGION_CLUSTERS);
    expect(region.clusters.every((c) => !!c.name)).toBe(true);
    expect(region.clusters.reduce((n, c) => n + c.count, 0)).toBe(APT_LISTINGS.length);

    const grid = searchMap(LISTINGS, CITY, MAP_ZOOM.GRID_MAX, f);
    expect(grid.kind).toBe(MapResultKind.GRID_CLUSTERS);
    expect(grid.clusters.reduce((n, c) => n + c.count, 0)).toBe(APT_LISTINGS.length);
    expect(grid.markers).toHaveLength(0);

    const markers = searchMap(LISTINGS, CITY, MAP_ZOOM.GRID_MAX + 1, f);
    expect(markers.kind).toBe(MapResultKind.MARKERS);
    expect(markers.markers.every((m) => m.type === 'COMPLEX')).toBe(true);
    expect(markers.markers.reduce((n, m) => n + m.count, 0)).toBe(markers.total);
  });

  it('groups rooms of one building into a single price marker', () => {
    const res = searchMap(LISTINGS, CITY, 17, { assetTypes: [AssetType.ONEROOM] });
    const marker = res.markers.find((m) => m.type === 'LISTING' && m.title === '해오름빌');
    expect(marker).toMatchObject({ type: 'LISTING', count: 4 });
    expect(res.summary?.avgMonthlyRent).toBeGreaterThan(20);
  });

  it('applies price filters only to the deal types they describe', () => {
    const f = { assetTypes: [AssetType.APT], priceMax: 30000, depositMax: 20000 };
    const matched = APT_LISTINGS.filter((l) => matchesFilter(l, f));
    expect(matched.length).toBeGreaterThan(0);
    for (const l of matched) {
      if (l.dealType === DealType.SALE || l.dealType === DealType.PRESALE)
        expect(headlinePrice(l)).toBeLessThanOrEqual(30000);
      else expect(l.deposit).toBeLessThanOrEqual(20000);
    }
    // Both kinds of listing survive: the 매매가 cap does not remove 전세·월세.
    expect(matched.some((l) => l.dealType === DealType.SALE)).toBe(true);
    expect(matched.some((l) => l.dealType === DealType.JEONSE)).toBe(true);
  });

  it('filters by bbox, options, verification and the assumed extras', () => {
    const none = searchMap(
      LISTINGS,
      { swLng: 127.0, swLat: 34.0, neLng: 127.1, neLat: 34.1 },
      17,
      {},
    );
    expect(none.total).toBe(0);
    const twoRooms = ROOM_LISTINGS.filter((l) =>
      matchesFilter(l, { roomTypes: ['TWO_ROOM'], verifiedOnly: true, options: ['ELEVATOR'] }),
    );
    expect(twoRooms.length).toBeGreaterThan(0);
    expect(
      twoRooms.every(
        (l) => l.roomType === 'TWO_ROOM' && !!l.verifiedAt && l.options.includes('ELEVATOR'),
      ),
    ).toBe(true);
    expect(
      LISTINGS.filter((l) => matchesFilter(l, { landZones: ['COMMERCIAL'] })).every(
        (l) => l.assetType === 'LAND',
      ),
    ).toBe(true);
  });

  it('sorts deterministically', () => {
    const asc = sortListings(ROOM_LISTINGS, ListingSort.PRICE_ASC).map(sortPrice);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const verified = sortListings(APT_LISTINGS, ListingSort.VERIFIED);
    expect(Date.parse(verified[0]?.verifiedAt ?? '')).toBeGreaterThanOrEqual(
      Date.parse(verified[5]?.verifiedAt ?? ''),
    );
    expect(sortListings(ROOM_LISTINGS, ListingSort.PHOTO).map((l) => l.id)).toEqual(
      sortListings([...ROOM_LISTINGS].reverse(), ListingSort.PHOTO).map((l) => l.id),
    );
  });
});
