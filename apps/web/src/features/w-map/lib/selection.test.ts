import { DealType } from '@house/shared';
import { describe, expect, it } from 'vitest';
import type { MapListingMarker } from '../api/schemas';
import { groupListingMarkers } from './markers';
import {
  hasNoComplex,
  markerSelectOptions,
  resolvePickedPill,
  selectedPill,
  standaloneBbox,
  standaloneCount,
} from './selection';

const pill = (id: string, lat: number, lng: number, count = 1): MapListingMarker => ({
  type: 'LISTING',
  id,
  lat,
  lng,
  dealType: DealType.MONTHLY,
  deposit: 300,
  monthlyRent: 30,
  count,
});

// 아파트 (complex mode): `GET /map/search` draws listings of a 단지 as COMPLEX markers, so every
// price pill is a listing registered without one (the owner's "300/30" test listing).
const solo = pill('l-solo', 34.94395, 127.52418);
const groups = groupListingMarkers([solo, pill('l-other', 34.95, 127.53, 2)], null);

describe('selected price pill (both list modes)', () => {
  it('resolves a pill of a listing without a 단지 to its building box', () => {
    const pick = resolvePickedPill('l-solo', groups, []);
    expect(pick).toMatchObject({ id: 'l-solo', lat: 34.94395, lng: 127.52418, merged: false });
    expect(pick!.area.swLat).toBeLessThan(34.94395);
    expect(pick!.area.neLat).toBeGreaterThan(34.94395);
  });

  it('returns null for a complex id or nothing selected', () => {
    expect(resolvePickedPill('complex-1', groups, [])).toBeNull();
    expect(resolvePickedPill(null, groups, [])).toBeNull();
  });

  it('locates another room of a pill through the known list rows (back / shared link)', () => {
    const rows = [{ id: 'l-solo-2', lat: 34.94395, lng: 127.52418 }];
    expect(resolvePickedPill('l-solo-2', groups, rows)).toMatchObject({
      id: 'l-solo-2',
      lat: solo.lat,
      lng: solo.lng,
    });
    // Outside every pill: a building-sized box at the row's own point.
    const away = resolvePickedPill('far', groups, [{ id: 'far', lat: 34.9, lng: 127.4 }]);
    expect(away).toMatchObject({ id: 'far', lat: 34.9, lng: 127.4, merged: false });
    expect(resolvePickedPill('nowhere', groups, [{ id: 'nowhere', lat: null, lng: null }])).toBe(
      null,
    );
  });
});

describe('단지 정보 없는 매물 section helpers', () => {
  it('counts the listings behind every pill', () => {
    expect(standaloneCount(groups)).toBe(3);
    expect(standaloneCount([])).toBe(0);
  });

  it('builds a bbox around the pills that keeps a single building (6 decimals)', () => {
    expect(standaloneBbox([])).toBeNull();
    const one = standaloneBbox(groupListingMarkers([solo], null))!;
    const [swLng, swLat, neLng, neLat] = one.split(',').map(Number) as [
      number,
      number,
      number,
      number,
    ];
    expect(swLng).toBeLessThan(solo.lng);
    expect(neLng).toBeGreaterThan(solo.lng);
    expect(swLat).toBeLessThan(solo.lat);
    expect(neLat).toBeGreaterThan(solo.lat);
    expect(standaloneBbox(groups)).toBe('127.524160,34.943930,127.530020,34.950020');
  });

  it('gives up on pills spread wider than the API accepts', () => {
    expect(standaloneBbox(groupListingMarkers([solo, pill('x', 37.5, 129.9)], null))).toBeNull();
  });

  it('keeps only listings without a 단지', () => {
    expect(hasNoComplex({ complexId: null })).toBe(true);
    expect(hasNoComplex({ complexId: undefined })).toBe(true);
    expect(hasNoComplex({ complexId: 'c1' })).toBe(false);
  });
});

describe('아파트 (complex mode): a price pill is a listing, not a complex', () => {
  const ctx = (patch: Partial<Parameters<typeof selectedPill>[1]> = {}) => ({
    complexMode: true,
    complexSelected: false,
    groups,
    listRows: [],
    soloRows: [],
    ...patch,
  });

  it('a selected pill opens the listing preview in complex mode too', () => {
    expect(selectedPill('l-solo', ctx())).toMatchObject({ id: 'l-solo', lat: solo.lat });
    // Another room of that building (back / shared link): found through the 단지 없는 rows.
    const soloRows = [{ id: 'l-solo-2', lat: solo.lat, lng: solo.lng }];
    expect(selectedPill('l-solo-2', ctx({ soloRows }))).toMatchObject({ lat: solo.lat });
    expect(selectedPill('l-solo-2', ctx({ listRows: soloRows }))).toBeNull();
  });

  it('a selected complex is never a pill; listing mode is unchanged', () => {
    expect(selectedPill('l-solo', ctx({ complexSelected: true }))).toBeNull();
    expect(selectedPill('l-solo', ctx({ complexMode: false }))).toMatchObject({ id: 'l-solo' });
  });

  it('clicking a pill never writes ?complex= and closes an open complex panel', () => {
    const at = (complexPanelOpen: boolean, isMobile: boolean) => ({
      complexMode: true,
      complexPanelOpen,
      isMobile,
    });
    for (const isMobile of [false, true]) {
      expect(markerSelectOptions('price', at(false, isMobile))).toEqual({
        complex: false,
        closeComplex: false,
      });
      expect(markerSelectOptions('price', at(true, isMobile))).toEqual({
        complex: false,
        closeComplex: true,
      });
    }
  });

  it('a complex marker still opens its panel (mobile at once, desktop when one is open)', () => {
    const at = (complexPanelOpen: boolean, isMobile: boolean) => ({
      complexMode: true,
      complexPanelOpen,
      isMobile,
    });
    expect(markerSelectOptions('complex', at(false, true)).complex).toBe(true);
    expect(markerSelectOptions('complex', at(false, false)).complex).toBe(false);
    expect(markerSelectOptions('complex', at(true, false))).toEqual({
      complex: true,
      closeComplex: false,
    });
    // Listing mode: no complex panel at all.
    expect(
      markerSelectOptions('price', { complexMode: false, complexPanelOpen: false, isMobile: true }),
    ).toEqual({ complex: false, closeComplex: false });
  });
});
