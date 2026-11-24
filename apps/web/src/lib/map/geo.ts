import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, MAP_ZOOM } from '@house/shared';
import type { LatLng, MapBounds } from './types';

export { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, MAP_ZOOM };

/** Geographic extent covered by the stylized Suncheon SVG (StaticMapView). Linear projection. */
export const STATIC_MAP_BOUNDS: MapBounds = {
  swLat: 34.905,
  swLng: 127.46,
  neLat: 34.99,
  neLng: 127.6,
};
/** Zoom at which the whole SVG "covers" the viewport. */
export const STATIC_MAP_BASE_ZOOM = 13;

export interface Size {
  width: number;
  height: number;
}
export interface Point {
  x: number;
  y: number;
}

/** lat/lng → art-space point (0..art.width, 0..art.height) of a linear bbox projection. */
export function projectToArt(p: LatLng, bounds: MapBounds, art: Size): Point {
  return {
    x: ((p.lng - bounds.swLng) / (bounds.neLng - bounds.swLng)) * art.width,
    y: ((bounds.neLat - p.lat) / (bounds.neLat - bounds.swLat)) * art.height,
  };
}

/** Inverse of `projectToArt`. */
export function unprojectFromArt(pt: Point, bounds: MapBounds, art: Size): LatLng {
  return {
    lng: bounds.swLng + (pt.x / art.width) * (bounds.neLng - bounds.swLng),
    lat: bounds.neLat - (pt.y / art.height) * (bounds.neLat - bounds.swLat),
  };
}

/** Screen px per art px at a zoom level ("cover" fit at the base zoom, ×2 per level). */
export function staticScale(
  viewport: Size,
  art: Size,
  zoom: number,
  baseZoom = STATIC_MAP_BASE_ZOOM,
): number {
  const cover = Math.max(viewport.width / art.width, viewport.height / art.height) || 1;
  return cover * 2 ** (zoom - baseZoom);
}

/** lat/lng → viewport px for the static map. */
export function projectToScreen(
  p: LatLng,
  center: LatLng,
  zoom: number,
  viewport: Size,
  art: Size,
  bounds = STATIC_MAP_BOUNDS,
): Point {
  const scale = staticScale(viewport, art, zoom);
  const a = projectToArt(p, bounds, art);
  const c = projectToArt(center, bounds, art);
  return {
    x: (a.x - c.x) * scale + viewport.width / 2,
    y: (a.y - c.y) * scale + viewport.height / 2,
  };
}

/** Visible geographic bounds of the static map for a view. */
export function staticViewBounds(
  center: LatLng,
  zoom: number,
  viewport: Size,
  art: Size,
  bounds = STATIC_MAP_BOUNDS,
): MapBounds {
  const scale = staticScale(viewport, art, zoom);
  const c = projectToArt(center, bounds, art);
  const halfW = viewport.width / 2 / scale;
  const halfH = viewport.height / 2 / scale;
  const sw = unprojectFromArt({ x: c.x - halfW, y: c.y + halfH }, bounds, art);
  const ne = unprojectFromArt({ x: c.x + halfW, y: c.y - halfH }, bounds, art);
  return { swLat: sw.lat, swLng: sw.lng, neLat: ne.lat, neLng: ne.lng };
}

/** API query value: "swLng,swLat,neLng,neLat" (see bboxSchema in @house/shared), 6 decimals. */
export function boundsToBboxParam(b: MapBounds): string {
  return [b.swLng, b.swLat, b.neLng, b.neLat].map((n) => n.toFixed(6)).join(',');
}

export function clampZoom(zoom: number): number {
  return Math.min(MAP_ZOOM.MAX, Math.max(MAP_ZOOM.MIN, zoom));
}

export function boundsContain(b: MapBounds, p: LatLng): boolean {
  return p.lat >= b.swLat && p.lat <= b.neLat && p.lng >= b.swLng && p.lng <= b.neLng;
}

/**
 * Grid (degrees) the device position is snapped to before the map moves to it ("내 위치"):
 * about 550 m north–south and 450 m east–west around 순천. The map view, and so the URL (`c=`)
 * and the bbox of every API request, only ever carry the cell — never the device position.
 */
export const DEVICE_POSITION_GRID_DEG = 0.005;

/** Centre of the DEVICE_POSITION_GRID_DEG cell that holds `p`. */
export function coarsenPosition(p: LatLng): LatLng {
  const snap = (n: number) =>
    Math.round((Math.floor(n / DEVICE_POSITION_GRID_DEG) + 0.5) * DEVICE_POSITION_GRID_DEG * 1e6) /
    1e6;
  return { lat: snap(p.lat), lng: snap(p.lng) };
}

/** Rounds coordinates for URLs (5 decimals ≈ 1 m). */
export function roundCoord(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}
