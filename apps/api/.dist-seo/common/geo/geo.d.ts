import type { Bbox } from '@house/shared';
import { Prisma } from '@prisma/client';
/**
 * Safe SQL fragments for PostGIS queries. Always compose with Prisma.sql / $queryRaw tagged
 * templates — never string concatenation. Values are bound as parameters.
 *
 *   const rows = await prisma.$queryRaw<Row[]>`
 *     SELECT id FROM listings
 *     WHERE ${withinBbox(Prisma.raw('location'), bbox)} AND status = 'ACTIVE'
 *     LIMIT ${MAP_MAX_MARKERS}`;
 */
/** geography envelope of a bbox (SRID 4326). */
export declare function bboxEnvelope(b: Bbox): Prisma.Sql;
/** `<column> && envelope` — index-assisted (GIST) bbox filter on a geography column. */
export declare function withinBbox(column: Prisma.Sql, b: Bbox): Prisma.Sql;
/** geography point literal. */
export declare function geoPoint(lat: number, lng: number): Prisma.Sql;
/** `ST_DWithin(<column>, point, meters)` — GIST-assisted radius filter. */
export declare function withinRadius(column: Prisma.Sql, lat: number, lng: number, meters: number): Prisma.Sql;
/**
 * Grid cell size in degrees for mid-zoom clustering (ST_SnapToGrid on geometry).
 * Roughly 60 px cells for Naver map zoom levels.
 */
export declare function gridSizeForZoom(zoom: number): number;
