/**
 * Map clustering bands, in web-map zoom levels (larger = closer, ×2 per step; the URL `z=` and the
 * `/map/search` `zoom`). The site draws with Kakao Maps, whose *level* runs the other way: level =
 * 20 − zoom at the same ground scale (apps/web `lib/map/kakao-level.ts`), so MIN 6 ↔ level 14
 * (Kakao's farthest) and MAX 19 ↔ level 1 (its closest).
 * - zoom <= REGION_MAX: cluster by 읍면동 (region aggregation)
 * - zoom <= GRID_MAX:   grid clustering (ST_SnapToGrid)
 * - otherwise:          individual complex / listing markers
 */
export const MAP_ZOOM = {
  MIN: 6,
  MAX: 19,
  REGION_MAX: 12,
  GRID_MAX: 15,
} as const;

export const MapResultKind = {
  REGION_CLUSTERS: 'REGION_CLUSTERS',
  GRID_CLUSTERS: 'GRID_CLUSTERS',
  MARKERS: 'MARKERS',
} as const;
export type MapResultKind = (typeof MapResultKind)[keyof typeof MapResultKind];

export function mapResultKindForZoom(zoom: number): MapResultKind {
  if (zoom <= MAP_ZOOM.REGION_MAX) return MapResultKind.REGION_CLUSTERS;
  if (zoom <= MAP_ZOOM.GRID_MAX) return MapResultKind.GRID_CLUSTERS;
  return MapResultKind.MARKERS;
}

/** Hard cap of markers returned for one bbox query. */
export const MAP_MAX_MARKERS = 500;
/** Max bbox span in degrees (prevents whole-country scans). */
export const MAP_MAX_BBOX_SPAN_DEG = 2;
