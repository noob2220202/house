import { DEFAULT_MAP_ZOOM, MAP_ZOOM, MapResultKind, mapResultKindForZoom } from '@house/shared';
import { describe, expect, it } from 'vitest';
import {
  KAKAO_LEVEL,
  kakaoLevelToZoom,
  kakaoMetresPerPx,
  kakaoPixelOffset,
  zoomToKakaoLevel,
} from './kakao-level';

const LEVELS = Array.from({ length: 14 }, (_, i) => i + 1);

describe('Kakao level ↔ app zoom', () => {
  it('inverts the scale: level 1 is the closest (zoom 19), level 14 the farthest (zoom 6)', () => {
    expect(zoomToKakaoLevel(MAP_ZOOM.MAX)).toBe(KAKAO_LEVEL.MIN);
    expect(zoomToKakaoLevel(MAP_ZOOM.MIN)).toBe(KAKAO_LEVEL.MAX);
    expect(kakaoLevelToZoom(KAKAO_LEVEL.MIN)).toBe(MAP_ZOOM.MAX);
    expect(kakaoLevelToZoom(KAKAO_LEVEL.MAX)).toBe(MAP_ZOOM.MIN);
    expect(zoomToKakaoLevel(DEFAULT_MAP_ZOOM)).toBe(7);
    // Closer zoom → smaller level.
    expect(zoomToKakaoLevel(16)).toBeLessThan(zoomToKakaoLevel(15));
  });

  it('round-trips every level and every whole app zoom', () => {
    for (const level of LEVELS) expect(zoomToKakaoLevel(kakaoLevelToZoom(level))).toBe(level);
    for (let z = MAP_ZOOM.MIN; z <= MAP_ZOOM.MAX; z++)
      expect(kakaoLevelToZoom(zoomToKakaoLevel(z))).toBe(z);
  });

  it('keeps the cluster bands of /map/search on the same levels', () => {
    // zoom ≤ 12 (REGION_MAX) → 읍면동 clusters = level ≥ 8; zoom ≤ 15 (GRID_MAX) → grid = 5…7.
    expect(zoomToKakaoLevel(MAP_ZOOM.REGION_MAX)).toBe(8);
    expect(zoomToKakaoLevel(MAP_ZOOM.GRID_MAX)).toBe(5);
    const kindAt = (level: number) => mapResultKindForZoom(kakaoLevelToZoom(level));
    expect(LEVELS.filter((l) => kindAt(l) === MapResultKind.MARKERS)).toEqual([1, 2, 3, 4]);
    expect(LEVELS.filter((l) => kindAt(l) === MapResultKind.GRID_CLUSTERS)).toEqual([5, 6, 7]);
    expect(LEVELS.filter((l) => kindAt(l) === MapResultKind.REGION_CLUSTERS)).toEqual([
      8, 9, 10, 11, 12, 13, 14,
    ]);
  });

  it('snaps half / out-of-range zooms to a level without changing the band', () => {
    expect(zoomToKakaoLevel(12.5)).toBe(7); // grid band → zoom 13 (grid)
    expect(zoomToKakaoLevel(15.5)).toBe(4); // markers band → zoom 16 (markers)
    expect(zoomToKakaoLevel(12.4)).toBe(8);
    for (const z of [12.5, 15.5, 13.25, 6.5])
      expect(mapResultKindForZoom(kakaoLevelToZoom(zoomToKakaoLevel(z)))).toBe(
        mapResultKindForZoom(z),
      );
    expect(zoomToKakaoLevel(21)).toBe(1);
    expect(zoomToKakaoLevel(2)).toBe(14);
    expect(zoomToKakaoLevel(Number.NaN)).toBe(14);
    expect(kakaoLevelToZoom(0)).toBe(19);
    expect(kakaoLevelToZoom(20)).toBe(6);
    expect(kakaoLevelToZoom(3.4)).toBe(17);
  });

  it('matches the web-map ground scale at 순천 (level 3 = 1 m/px ≈ zoom 17)', () => {
    expect(kakaoMetresPerPx(3)).toBe(1);
    expect(kakaoMetresPerPx(1)).toBe(0.25);
    const mercatorMpp = (zoom: number) =>
      (156_543.03 * Math.cos((34.95 * Math.PI) / 180)) / 2 ** zoom;
    for (const level of LEVELS) {
      const ratio = kakaoMetresPerPx(level) / mercatorMpp(kakaoLevelToZoom(level));
      expect(ratio).toBeGreaterThan(0.97);
      expect(ratio).toBeLessThan(1.03);
    }
  });

  it('projects nearby points to px offsets from the centre', () => {
    const c = { lat: 34.95, lng: 127.49 };
    const same = kakaoPixelOffset(c, c, 16);
    expect(Math.abs(same.x) + Math.abs(same.y)).toBe(0);
    // ~1 km east / north at zoom 16 (level 4 = 2 m/px) → ~500 px right / up.
    const east = kakaoPixelOffset({ lat: c.lat, lng: c.lng + 0.01095 }, c, 16);
    expect(east.x).toBeGreaterThan(490);
    expect(east.x).toBeLessThan(510);
    expect(Math.abs(east.y)).toBeLessThan(1e-9);
    const north = kakaoPixelOffset({ lat: c.lat + 0.009, lng: c.lng }, c, 16);
    expect(north.y).toBeLessThan(-490);
    expect(north.y).toBeGreaterThan(-510);
    // One level farther out halves the distance.
    expect(kakaoPixelOffset({ lat: c.lat + 0.009, lng: c.lng }, c, 15).y).toBeCloseTo(north.y / 2);
  });
});
