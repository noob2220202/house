import { createHash } from 'node:crypto';
import {
  mapResultKindForZoom,
  type Bbox,
  type ListingFilter,
  type MapResultKind,
} from '@house/shared';
import { gridSizeForZoom } from '../../../common/geo/geo';

/** Tile edge (degrees) used to align/cache map queries: 4 grid cells of the zoom level. */
export function tileSizeForZoom(zoom: number): number {
  return gridSizeForZoom(zoom) * 4;
}

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

/**
 * Expands a bbox outward to tile boundaries so nearby viewports share one cached result and grid
 * cells (aligned to the same origin as ST_SnapToGrid) are never split across queries.
 */
export function tileAlignedBbox(b: Bbox, zoom: number): Bbox {
  const t = tileSizeForZoom(zoom);
  return {
    swLng: round6(Math.floor(b.swLng / t) * t),
    swLat: round6(Math.floor(b.swLat / t) * t),
    neLng: round6(Math.ceil(b.neLng / t) * t),
    neLat: round6(Math.ceil(b.neLat / t) * t),
  };
}

export interface MapPlan {
  kind: MapResultKind;
  zoom: number;
  bbox: Bbox;
  gridSize: number;
}

export function planMapQuery(bbox: Bbox, zoom: number): MapPlan {
  const z = Math.round(zoom);
  return {
    kind: mapResultKindForZoom(z),
    zoom: z,
    bbox: tileAlignedBbox(bbox, z),
    gridSize: gridSizeForZoom(z),
  };
}

/** Stable short hash of the filter values (order-insensitive for arrays and keys). */
export function filterFingerprint(f: ListingFilter): string {
  const normalized = Object.keys(f)
    .sort()
    .flatMap((k) => {
      const v = f[k as keyof ListingFilter];
      if (v === undefined) return [];
      return [[k, Array.isArray(v) ? [...(v as string[])].sort() : v] as const];
    });
  return createHash('sha1').update(JSON.stringify(normalized)).digest('hex').slice(0, 16);
}

export function mapTileCacheKey(plan: MapPlan, filter: ListingFilter, version: number): string {
  const b = plan.bbox;
  return `cache:listings:map:v${version}:${plan.kind}:${plan.zoom}:${b.swLng},${b.swLat},${b.neLng},${b.neLat}:${filterFingerprint(filter)}`;
}
