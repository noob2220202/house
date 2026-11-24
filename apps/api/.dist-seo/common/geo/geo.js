"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bboxEnvelope = bboxEnvelope;
exports.withinBbox = withinBbox;
exports.geoPoint = geoPoint;
exports.withinRadius = withinRadius;
exports.gridSizeForZoom = gridSizeForZoom;
const client_1 = require("@prisma/client");
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
function bboxEnvelope(b) {
    return client_1.Prisma.sql `ST_MakeEnvelope(${b.swLng}, ${b.swLat}, ${b.neLng}, ${b.neLat}, 4326)::geography`;
}
/** `<column> && envelope` — index-assisted (GIST) bbox filter on a geography column. */
function withinBbox(column, b) {
    return client_1.Prisma.sql `${column} && ${bboxEnvelope(b)}`;
}
/** geography point literal. */
function geoPoint(lat, lng) {
    return client_1.Prisma.sql `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
}
/** `ST_DWithin(<column>, point, meters)` — GIST-assisted radius filter. */
function withinRadius(column, lat, lng, meters) {
    return client_1.Prisma.sql `ST_DWithin(${column}, ${geoPoint(lat, lng)}, ${meters})`;
}
/**
 * Grid cell size in degrees for mid-zoom clustering (ST_SnapToGrid on geometry).
 * Roughly 60 px cells for Naver map zoom levels.
 */
function gridSizeForZoom(zoom) {
    return 360 / 2 ** Math.round(zoom) / 4;
}
//# sourceMappingURL=geo.js.map