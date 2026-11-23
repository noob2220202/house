import { MapResultKind } from '@house/shared';
import {
  filterFingerprint,
  mapTileCacheKey,
  planMapQuery,
  tileAlignedBbox,
  tileSizeForZoom,
} from './map-tiles';

describe('map tiles', () => {
  const bbox = { swLng: 127.4812, swLat: 34.9433, neLng: 127.5021, neLat: 34.9577 };

  it('expands the bbox outward to tile boundaries', () => {
    const t = tileSizeForZoom(14);
    const b = tileAlignedBbox(bbox, 14);
    expect(b.swLng).toBeLessThanOrEqual(bbox.swLng);
    expect(b.swLat).toBeLessThanOrEqual(bbox.swLat);
    expect(b.neLng).toBeGreaterThanOrEqual(bbox.neLng);
    expect(b.neLat).toBeGreaterThanOrEqual(bbox.neLat);
    // Exact multiples (no rounding), so tile edges coincide with grid-cell edges.
    for (const v of Object.values(b)) expect(Number.isInteger(v / t)).toBe(true);
    expect(b.swLng).toBe(5801 * t);
  });

  it('nearby viewports share one tile key', () => {
    const shifted = { ...bbox, swLng: bbox.swLng + 0.0004, neLng: bbox.neLng + 0.0004 };
    const a = mapTileCacheKey(planMapQuery(bbox, 14), {}, 3);
    const b = mapTileCacheKey(planMapQuery(shifted, 14.2), {}, 3);
    expect(a).toBe(b);
    expect(mapTileCacheKey(planMapQuery(bbox, 14), {}, 4)).not.toBe(a);
  });

  it('picks the result kind from the rounded zoom', () => {
    expect(planMapQuery(bbox, 12.4).kind).toBe(MapResultKind.REGION_CLUSTERS);
    expect(planMapQuery(bbox, 12.6).kind).toBe(MapResultKind.GRID_CLUSTERS);
    expect(planMapQuery(bbox, 16).kind).toBe(MapResultKind.MARKERS);
  });

  it('filter fingerprint ignores key and array order and undefined values', () => {
    expect(filterFingerprint({ dealTypes: ['SALE', 'JEONSE'], priceMax: 5 })).toBe(
      filterFingerprint({ priceMax: 5, dealTypes: ['JEONSE', 'SALE'], rentMin: undefined }),
    );
    expect(filterFingerprint({ priceMax: 5 })).not.toBe(filterFingerprint({ priceMax: 6 }));
  });
});
