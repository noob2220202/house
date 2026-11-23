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
export function bboxEnvelope(b: Bbox): Prisma.Sql {
  return Prisma.sql`ST_MakeEnvelope(${b.swLng}, ${b.swLat}, ${b.neLng}, ${b.neLat}, 4326)::geography`;
}

/** `<column> && envelope` — index-assisted (GIST) bbox filter on a geography column. */
export function withinBbox(column: Prisma.Sql, b: Bbox): Prisma.Sql {
  return Prisma.sql`${column} && ${bboxEnvelope(b)}`;
}

/** geography point literal. */
export function geoPoint(lat: number, lng: number): Prisma.Sql {
  return Prisma.sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
}

/** `ST_DWithin(<column>, point, meters)` — GIST-assisted radius filter. */
export function withinRadius(
  column: Prisma.Sql,
  lat: number,
  lng: number,
  meters: number,
): Prisma.Sql {
  return Prisma.sql`ST_DWithin(${column}, ${geoPoint(lat, lng)}, ${meters})`;
}

/**
 * Grid cell size in degrees for mid-zoom clustering (ST_SnapToGrid on geometry).
 * Roughly 60 px cells for Naver map zoom levels.
 */
export function gridSizeForZoom(zoom: number): number {
  return 360 / 2 ** Math.round(zoom) / 4;
}
