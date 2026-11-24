import { describe, expect, it } from 'vitest';
import {
  STATIC_MAP_BOUNDS,
  boundsContain,
  boundsToBboxParam,
  projectToArt,
  projectToScreen,
  staticScale,
  staticViewBounds,
  unprojectFromArt,
} from './geo';
import {
  buildMapHref,
  countActiveFilters,
  defaultFilters,
  defineFilters,
  parseFilters,
  parseMapView,
  parseSelected,
  serializeFilters,
  serializeMapView,
} from './url-state';

const ART = { width: 1200, height: 720 };

describe('static map projection', () => {
  it('maps bbox corners to art corners and back', () => {
    const b = STATIC_MAP_BOUNDS;
    expect(projectToArt({ lat: b.neLat, lng: b.swLng }, b, ART)).toEqual({ x: 0, y: 0 });
    expect(projectToArt({ lat: b.swLat, lng: b.neLng }, b, ART)).toEqual({ x: 1200, y: 720 });
    const p = { lat: 34.9506, lng: 127.4872 };
    const back = unprojectFromArt(projectToArt(p, b, ART), b, ART);
    expect(back.lat).toBeCloseTo(p.lat, 9);
    expect(back.lng).toBeCloseTo(p.lng, 9);
  });
  it('puts the view center in the middle of the viewport and doubles scale per zoom level', () => {
    const viewport = { width: 600, height: 360 };
    const center = { lat: 34.95, lng: 127.53 };
    expect(projectToScreen(center, center, 14, viewport, ART)).toEqual({ x: 300, y: 180 });
    expect(staticScale(viewport, ART, 14)).toBeCloseTo(staticScale(viewport, ART, 13) * 2, 9);
  });
  it('computes visible bounds that contain the center and shrink when zooming in', () => {
    const viewport = { width: 600, height: 360 };
    const center = { lat: 34.95, lng: 127.53 };
    const wide = staticViewBounds(center, 13, viewport, ART);
    const near = staticViewBounds(center, 15, viewport, ART);
    expect(boundsContain(wide, center)).toBe(true);
    expect(near.neLng - near.swLng).toBeCloseTo((wide.neLng - wide.swLng) / 4, 9);
    expect(boundsToBboxParam({ swLat: 34.9, swLng: 127.4, neLat: 35, neLng: 127.6 })).toBe(
      '127.400000,34.900000,127.600000,35.000000',
    );
  });
});

describe('map url state', () => {
  const FILTERS = defineFilters({
    deal: { type: 'csv' },
    priceMin: { type: 'number' },
    priceMax: { type: 'number' },
    unit: { type: 'string', default: 'pyeong' },
    parking: { type: 'boolean' },
  });

  it('parses and serializes the view', () => {
    const sp = serializeMapView({ center: { lat: 34.9506371, lng: 127.4872139 }, zoom: 14 });
    expect(sp.toString()).toBe('c=34.95064%2C127.48721&z=14');
    expect(parseMapView(sp)).toEqual({ center: { lat: 34.95064, lng: 127.48721 }, zoom: 14 });
  });
  it('falls back on invalid or out-of-range input', () => {
    const fallback = { center: { lat: 34.95, lng: 127.49 }, zoom: 13 };
    expect(parseMapView(new URLSearchParams('c=abc&z=xyz'), fallback)).toEqual(fallback);
    expect(parseMapView(new URLSearchParams('c=10,10&z=99'), fallback)).toEqual({
      center: fallback.center,
      zoom: 19, // MAP_ZOOM.MAX (Kakao level 1)
    });
    expect(parseSelected(new URLSearchParams('sel=c01'))).toBe('c01');
    expect(parseSelected(new URLSearchParams(''))).toBeNull();
  });
  it('round-trips filters and omits defaults', () => {
    expect(defaultFilters(FILTERS)).toEqual({
      deal: [],
      priceMin: null,
      priceMax: null,
      unit: 'pyeong',
      parking: false,
    });
    const values = {
      deal: ['SALE', 'JEONSE'],
      priceMin: 30000,
      priceMax: null,
      unit: 'pyeong',
      parking: true,
    };
    const sp = serializeFilters(FILTERS, values);
    expect(sp.toString()).toBe('deal=SALE%2CJEONSE&priceMin=30000&parking=1');
    expect(parseFilters(FILTERS, sp)).toEqual(values);
    expect(countActiveFilters(FILTERS, values)).toBe(3);
    expect(countActiveFilters(FILTERS, defaultFilters(FILTERS))).toBe(0);
  });
  it('ignores garbage numbers', () => {
    expect(parseFilters(FILTERS, new URLSearchParams('priceMin=abc')).priceMin).toBeNull();
  });
  it('builds shareable hrefs', () => {
    const href = buildMapHref('/map/apt', {
      view: { center: { lat: 34.95, lng: 127.53 }, zoom: 15 },
      selected: 'c01',
      spec: FILTERS,
      filters: { deal: ['SALE'] },
    });
    expect(href).toBe('/map/apt?c=34.95%2C127.53&z=15&sel=c01&deal=SALE');
    expect(buildMapHref('/map/apt', {})).toBe('/map/apt');
  });
});
