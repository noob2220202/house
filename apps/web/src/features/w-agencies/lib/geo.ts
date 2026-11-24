import { MAP_MAX_BBOX_SPAN_DEG } from '@house/shared';
import { SUNCHEON_MAP_VIEWBOX } from '@house/ui';
import { boundsToBboxParam, staticViewBounds } from '@/lib/map/geo';
import type { LatLng, MapBounds, MapImpl, MapViewState } from '@/lib/map/types';

/** Metres per degree of longitude at a latitude. */
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/**
 * `bbox` query value for the visible map area. The backend rejects spans above
 * `MAP_MAX_BBOX_SPAN_DEG`, so a far-zoomed-out view is clamped around its centre. Coordinates are
 * rounded to 4 decimals (≈10 m) so tiny pans reuse the cached result.
 */
export function boundsToQueryBbox(bounds: MapBounds): string {
  const max = MAP_MAX_BBOX_SPAN_DEG - 0.01;
  const clampAxis = (lo: number, hi: number): [number, number] => {
    if (hi - lo <= max) return [lo, hi];
    const mid = (lo + hi) / 2;
    return [mid - max / 2, mid + max / 2];
  };
  const round = (n: number) => Math.round(n * 1e4) / 1e4;
  const [swLng, neLng] = clampAxis(bounds.swLng, bounds.neLng);
  const [swLat, neLat] = clampAxis(bounds.swLat, bounds.neLat);
  return boundsToBboxParam({
    swLng: round(swLng),
    neLng: round(neLng),
    swLat: round(swLat),
    neLat: round(neLat),
  });
}

/**
 * Visible bounds of the map for the marker query, "이 지역에서 다시 검색" and the scale bar.
 * - Kakao map: the bounds it last reported (it reports after every move, programmatic ones too).
 * - Stylized fallback map: derived from the controlled view + the map size. That map only reports
 *   moves the user makes (drag / wheel), not prop changes (zoom buttons, cluster click, 지역,
 *   내 위치, pan on select), so its last report goes stale after those.
 */
export function currentMapBounds(
  impl: MapImpl,
  view: MapViewState,
  size: { width: number; height: number },
  reported: MapBounds | null,
): MapBounds | null {
  if (impl === 'kakao') return reported;
  if (!(size.width > 0) || !(size.height > 0)) return null;
  return staticViewBounds(view.center, view.zoom, size, SUNCHEON_MAP_VIEWBOX);
}

/**
 * Where to move the map centre so `target` is comfortably visible, or null when it already is.
 * `coveredRight` = fraction (0–1) of the map width hidden under the profile drawer; the target is
 * then centred in the remaining free area.
 */
export function panTarget(
  target: LatLng,
  bounds: MapBounds,
  coveredRight = 0,
  margin = 0.1,
): LatLng | null {
  const lngSpan = bounds.neLng - bounds.swLng;
  const latSpan = bounds.neLat - bounds.swLat;
  if (!(lngSpan > 0) || !(latSpan > 0)) return null;
  const covered = Math.min(Math.max(coveredRight, 0), 0.8);
  const freeEast = bounds.neLng - lngSpan * covered;
  const freeSpan = freeEast - bounds.swLng;
  const visible =
    target.lng >= bounds.swLng + freeSpan * margin &&
    target.lng <= freeEast - freeSpan * margin &&
    target.lat >= bounds.swLat + latSpan * margin &&
    target.lat <= bounds.neLat - latSpan * margin;
  if (visible) return null;
  // Centre of the free area sits (covered / 2) of the span west of the map centre.
  return { lat: target.lat, lng: target.lng + (lngSpan * covered) / 2 };
}

/**
 * Keeps a map centre inside `limit` so the viewport (same size as `viewBounds`) does not run past
 * the edge — used with the stylized fallback map, whose art ends at its bbox. `coveredRight` lets
 * the view overshoot the east edge by the part hidden under the profile drawer.
 */
export function clampCenter(
  center: LatLng,
  viewBounds: MapBounds,
  limit: MapBounds,
  coveredRight = 0,
): LatLng {
  const lngSpan = viewBounds.neLng - viewBounds.swLng;
  const latSpan = viewBounds.neLat - viewBounds.swLat;
  const clampAxis = (value: number, min: number, max: number) =>
    min > max ? (min + max) / 2 : Math.min(Math.max(value, min), max);
  return {
    lng: clampAxis(
      center.lng,
      limit.swLng + lngSpan / 2,
      limit.neLng - lngSpan / 2 + lngSpan * Math.min(Math.max(coveredRight, 0), 0.8),
    ),
    lat: clampAxis(center.lat, limit.swLat + latSpan / 2, limit.neLat - latSpan / 2),
  };
}

export interface ScaleBar {
  /** "500m", "2km" */
  label: string;
  /** Bar width in CSS px. */
  width: number;
}

const SCALE_STEPS = [50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000] as const;

/** Map scale for the current view: the largest round distance whose bar fits in `maxPx`. */
export function scaleBar(bounds: MapBounds, mapWidthPx: number, maxPx = 72): ScaleBar | null {
  const lngSpan = bounds.neLng - bounds.swLng;
  if (!(lngSpan > 0) || !(mapWidthPx > 0)) return null;
  const midLat = (bounds.swLat + bounds.neLat) / 2;
  const metresPerPx = (lngSpan * mPerDegLng(midLat)) / mapWidthPx;
  let step: number = SCALE_STEPS[0];
  for (const s of SCALE_STEPS) if (s / metresPerPx <= maxPx) step = s;
  return {
    label: step >= 1000 ? `${step / 1000}km` : `${step}m`,
    width: Math.max(8, Math.round(step / metresPerPx)),
  };
}

/** Rough service area — "내 위치" outside of it is not useful on this map. */
export function isNearSuncheon(p: LatLng): boolean {
  return p.lat >= 34.7 && p.lat <= 35.25 && p.lng >= 127.15 && p.lng <= 127.85;
}
