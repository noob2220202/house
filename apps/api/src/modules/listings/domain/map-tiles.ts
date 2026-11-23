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

/**
 * Expands a bbox outward to tile boundaries so nearby viewports share one cached result and grid
 * cells ([k·size, (k+1)·size), see ListingSearchRepository.gridSql) are never split across tiles.
 * Edges are exact integer multiples of the tile size (360/2^z is a binary fraction, so k·t is
 * exact in float64); they must not be rounded, or cell edges and tile edges would drift apart.
 */
export function tileAlignedBbox(b: Bbox, zoom: number): Bbox {
  const t = tileSizeForZoom(zoom);
  return {
    swLng: Math.floor(b.swLng / t) * t,
    swLat: Math.floor(b.swLat / t) * t,
    neLng: Math.ceil(b.neLng / t) * t,
    neLat: Math.ceil(b.neLat / t) * t,
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
