import { MAP_MAX_BBOX_SPAN_DEG } from '@house/shared';
import { boundsToBboxParam, type LatLng, type MapBounds } from '@/lib/map';

export interface Size {
  width: number;
  height: number;
}

/**
 * bbox query value for the visible bounds: rounded to 4 decimals (~10 m, better cache hits) and
 * shrunk around its centre when the map is zoomed out beyond the API's span limit.
 */
export function bboxParam(b: MapBounds, maxSpan = MAP_MAX_BBOX_SPAN_DEG): string {
  const clamp = (lo: number, hi: number): [number, number] => {
    if (hi - lo <= maxSpan) return [lo, hi];
    const mid = (lo + hi) / 2;
    return [mid - maxSpan / 2, mid + maxSpan / 2];
  };
  const r = (n: number) => Math.round(n * 1e4) / 1e4;
  const [swLng, neLng] = clamp(b.swLng, b.neLng);
  const [swLat, neLat] = clamp(b.swLat, b.neLat);
  return boundsToBboxParam({ swLng: r(swLng), swLat: r(swLat), neLng: r(neLng), neLat: r(neLat) });
}

/**
 * lat/lng → px inside the map viewport, from the visible bounds alone (works for both map
 * implementations; at city scale Mercator is linear enough for placing a popover).
 */
export function projectToViewport(p: LatLng, b: MapBounds, size: Size): { x: number; y: number } {
  return {
    x: ((p.lng - b.swLng) / (b.neLng - b.swLng)) * size.width,
    y: ((b.neLat - p.lat) / (b.neLat - b.swLat)) * size.height,
  };
}

const EARTH_M_PER_DEG = 111_320;

/** Great-circle-ish distance in metres (equirectangular; fine below a few km). */
export function distanceM(a: LatLng, b: LatLng): number {
  const dy = (a.lat - b.lat) * EARTH_M_PER_DEG;
  const dx = (a.lng - b.lng) * EARTH_M_PER_DEG * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(dx, dy);
}

const SCALE_STEPS = [20, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 20000, 50000];

/** Scale bar: the largest round distance that fits in `maxPx`, with its width in px. */
export function scaleBar(
  b: MapBounds,
  widthPx: number,
  maxPx = 72,
): { meters: number; px: number; label: string } | null {
  if (widthPx <= 0) return null;
  const midLat = (b.swLat + b.neLat) / 2;
  const metersPerPx =
    ((b.neLng - b.swLng) * EARTH_M_PER_DEG * Math.cos(midLat * (Math.PI / 180))) / widthPx;
  if (!Number.isFinite(metersPerPx) || metersPerPx <= 0) return null;
  const meters =
    [...SCALE_STEPS].reverse().find((m) => m / metersPerPx <= maxPx) ?? SCALE_STEPS[0]!;
  return {
    meters,
    px: Math.round(meters / metersPerPx),
    label: meters >= 1000 ? `${meters / 1000}km` : `${meters}m`,
  };
}

/** Closest region centre to a point (the breadcrumb's current 동). */
export function nearestRegion<T extends LatLng>(regions: readonly T[], p: LatLng): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const r of regions) {
    const d = distanceM(r, p);
    if (d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
}

export interface Placement {
  left: number;
  top: number;
  side: 'right' | 'left';
  /** Arrow offset from the card's top edge. */
  arrowTop: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
const intersects = (a: Rect, b: Rect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/**
 * Where to draw a popover beside an anchor point without leaving the viewport: right of the anchor
 * when it fits, else left; vertically `ratio` of the card sits above the anchor, clamped to the
 * viewport. Boxes in `avoid` (ad card, tool column) are not covered: the card flips to the other
 * side or slides below them. Returns null when the anchor is off screen (the caller docks the card).
 */
export function placePopover(
  anchor: { x: number; y: number },
  card: Size,
  viewport: Size,
  {
    gap = 28,
    ratio = 0.34,
    margin = 12,
    avoid = [],
  }: { gap?: number; ratio?: number; margin?: number; avoid?: readonly Rect[] } = {},
): Placement | null {
  const out = 24;
  if (
    anchor.x < -out ||
    anchor.y < -out ||
    anchor.x > viewport.width + out ||
    anchor.y > viewport.height + out
  )
    return null;
  const clampTop = (top: number) =>
    Math.max(margin, Math.min(top, viewport.height - card.height - margin));
  const top = clampTop(anchor.y - card.height * ratio);
  const at = (side: 'right' | 'left', y = top) => {
    const raw = side === 'right' ? anchor.x + gap : anchor.x - gap - card.width;
    const left = Math.max(margin, Math.min(raw, viewport.width - card.width - margin));
    const rect: Rect = { left, top: y, right: left + card.width, bottom: y + card.height };
    const fits = raw >= margin && raw + card.width + margin <= viewport.width;
    return { side, rect, fits, clear: !avoid.some((box) => intersects(rect, box)) };
  };
  const right = at('right');
  const left = at('left');
  let pick = [right, left].find((c) => c.fits && c.clear);
  if (!pick) {
    // Neither side is free at the natural height → slide below the boxes in the way.
    const base = right.fits || !left.fits ? right : left;
    const below = Math.max(
      ...avoid.filter((box) => intersects(base.rect, box)).map((b) => b.bottom),
    );
    pick = Number.isFinite(below) ? at(base.side, clampTop(below + margin)) : base;
  }
  const arrowTop = Math.max(18, Math.min(anchor.y - pick.rect.top, card.height - 18));
  return { left: pick.rect.left, top: pick.rect.top, side: pick.side, arrowTop };
}

// ---- view helpers -------------------------------------------------------------------------------

/** Screen px per degree of a map showing `b` in `size` (null until both are known). */
export function pxPerDegree(b: MapBounds | null, size: Size): { lng: number; lat: number } | null {
  if (!b || size.width <= 0 || size.height <= 0) return null;
  const lng = size.width / (b.neLng - b.swLng);
  const lat = size.height / (b.neLat - b.swLat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng <= 0 || lat <= 0) return null;
  // Panning must not change the scale by float noise (the price pills would regroup).
  return { lng: Number(lng.toPrecision(6)), lat: Number(lat.toPrecision(6)) };
}

/** Chrome covering the edges of the map, in px (floating search, bottom sheet, ad column …). */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Map centre that shows `target` in the middle of the area the chrome leaves free. The map element
 * itself keeps its size (resizing a map SDK's container on every sheet move is fragile); only the
 * point we centre on is shifted.
 */
export function centerForTarget(
  target: LatLng,
  insets: Insets,
  pxPerDeg: { lng: number; lat: number },
): LatLng {
  return {
    lat: target.lat + (insets.top - insets.bottom) / 2 / pxPerDeg.lat,
    lng: target.lng - (insets.left - insets.right) / 2 / pxPerDeg.lng,
  };
}

/** Bounds without the strip at the bottom that a sheet of `coveredPx` hides (at least 20% stays). */
export function cropBottom(b: MapBounds, heightPx: number, coveredPx: number): MapBounds {
  if (heightPx <= 0 || coveredPx <= 0) return b;
  const keep = Math.max(0.2, 1 - coveredPx / heightPx);
  return { ...b, swLat: b.neLat - (b.neLat - b.swLat) * keep };
}

export type SheetStopName = 'peek' | 'half' | 'full';

/** Height of the peeking mobile sheet: handle + title + sort tabs. */
export const SHEET_PEEK_PX = 112;

/**
 * Height in px of the mobile bottom sheet at a stop. Mirrors `--sheet-h` in
 * MapSearchPage.module.css — change both together. The half stop always leaves the floating
 * search + about 170px of map above it, which matters on short phones.
 */
export function sheetHeightPx(stop: SheetStopName, pageHeight: number): number {
  if (stop === 'peek' || pageHeight <= 0) return SHEET_PEEK_PX;
  if (stop === 'full') return Math.max(SHEET_PEEK_PX, pageHeight - 124);
  return Math.max(SHEET_PEEK_PX, Math.min(pageHeight * 0.56, pageHeight - 340));
}
