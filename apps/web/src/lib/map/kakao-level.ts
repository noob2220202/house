import { MAP_ZOOM } from '@house/shared';
import type { LatLng } from './types';

/**
 * Kakao Maps levels vs the app's zoom.
 *
 * The app (URL `z=`, `/map/search` zoom, `MAP_ZOOM` cluster bands, the static fallback map) speaks
 * web-map zoom: larger = closer, ×2 per step. Kakao Maps uses *levels* the other way round:
 * level 1 is the closest, 14 the farthest, and level L draws 2^(L−3) m per CSS px (level 3 =
 * 1 m/px; the SDK sends `SCALE=0.3125·2^L` WCONGNAMUL units = 0.125·2^L m). Web-Mercator zoom z at
 * 순천's latitude (≈34.95°) draws 156 543·cos φ / 2^z ≈ 2^(16.97−z) m/px, so the same ground scale is
 *
 *     zoom = 20 − level        (level 1 ↔ zoom 19, level 14 ↔ zoom 6)
 *
 * which keeps every band of `MAP_ZOOM` on the same map scale it was tuned for:
 * REGION_MAX 12 ↔ level 8, GRID_MAX 15 ↔ level 5, DEFAULT_MAP_ZOOM 13 ↔ level 7.
 */
export const KAKAO_LEVEL = { MIN: 1, MAX: 14 } as const;
export const KAKAO_ZOOM_SUM = 20;

/** App zoom → Kakao level (integer: Kakao has no fractional levels), clamped to 1…14. */
export function zoomToKakaoLevel(zoom: number): number {
  if (!Number.isFinite(zoom)) return KAKAO_ZOOM_SUM - MAP_ZOOM.MIN;
  // Half steps (old URLs from the static map, which zooms by 0.5) go to the closer level, so the
  // `MAP_ZOOM` band stays the same: 12.5 (grid) → level 7 = zoom 13, 15.5 (markers) → zoom 16.
  const level = Math.round(KAKAO_ZOOM_SUM - zoom - 1e-9);
  return Math.min(KAKAO_LEVEL.MAX, Math.max(KAKAO_LEVEL.MIN, level));
}

/** Kakao level → app zoom. */
export function kakaoLevelToZoom(level: number): number {
  const l = Math.min(KAKAO_LEVEL.MAX, Math.max(KAKAO_LEVEL.MIN, Math.round(level)));
  return KAKAO_ZOOM_SUM - l;
}

/** Ground metres per CSS px at a Kakao level. */
export function kakaoMetresPerPx(level: number): number {
  return 2 ** (level - 3);
}

const M_PER_DEG_LAT = 110_950;
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/**
 * Offset in CSS px of `p` from the map centre `c` on a Kakao map showing app zoom `zoom` (it is
 * drawn at `zoomToKakaoLevel(zoom)`). x grows east, y grows south. Used by overlays that are not
 * map markers (the listing mini map's nearby places).
 */
export function kakaoPixelOffset(p: LatLng, c: LatLng, zoom: number): { x: number; y: number } {
  const mpp = kakaoMetresPerPx(zoomToKakaoLevel(zoom));
  const midLat = (p.lat + c.lat) / 2;
  return {
    x: ((p.lng - c.lng) * mPerDegLng(midLat)) / mpp,
    y: (-(p.lat - c.lat) * M_PER_DEG_LAT) / mpp,
  };
}
