import { type Bbox, type ListingFilter, type MapResultKind } from '@house/shared';
/** Tile edge (degrees) used to align/cache map queries: 4 grid cells of the zoom level. */
export declare function tileSizeForZoom(zoom: number): number;
/**
 * Expands a bbox outward to tile boundaries so nearby viewports share one cached result and grid
 * cells ([k·size, (k+1)·size), see ListingSearchRepository.gridSql) are never split across tiles.
 * Edges are exact integer multiples of the tile size (360/2^z is a binary fraction, so k·t is
 * exact in float64); they must not be rounded, or cell edges and tile edges would drift apart.
 */
export declare function tileAlignedBbox(b: Bbox, zoom: number): Bbox;
export interface MapPlan {
    kind: MapResultKind;
    zoom: number;
    bbox: Bbox;
    gridSize: number;
}
export declare function planMapQuery(bbox: Bbox, zoom: number): MapPlan;
/** Stable short hash of the filter values (order-insensitive for arrays and keys). */
export declare function filterFingerprint(f: ListingFilter): string;
export declare function mapTileCacheKey(plan: MapPlan, filter: ListingFilter, version: number): string;
