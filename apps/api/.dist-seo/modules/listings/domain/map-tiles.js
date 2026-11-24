"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tileSizeForZoom = tileSizeForZoom;
exports.tileAlignedBbox = tileAlignedBbox;
exports.planMapQuery = planMapQuery;
exports.filterFingerprint = filterFingerprint;
exports.mapTileCacheKey = mapTileCacheKey;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@house/shared");
const geo_1 = require("../../../common/geo/geo");
/** Tile edge (degrees) used to align/cache map queries: 4 grid cells of the zoom level. */
function tileSizeForZoom(zoom) {
    return (0, geo_1.gridSizeForZoom)(zoom) * 4;
}
/**
 * Expands a bbox outward to tile boundaries so nearby viewports share one cached result and grid
 * cells ([k·size, (k+1)·size), see ListingSearchRepository.gridSql) are never split across tiles.
 * Edges are exact integer multiples of the tile size (360/2^z is a binary fraction, so k·t is
 * exact in float64); they must not be rounded, or cell edges and tile edges would drift apart.
 */
function tileAlignedBbox(b, zoom) {
    const t = tileSizeForZoom(zoom);
    return {
        swLng: Math.floor(b.swLng / t) * t,
        swLat: Math.floor(b.swLat / t) * t,
        neLng: Math.ceil(b.neLng / t) * t,
        neLat: Math.ceil(b.neLat / t) * t,
    };
}
function planMapQuery(bbox, zoom) {
    const z = Math.round(zoom);
    return {
        kind: (0, shared_1.mapResultKindForZoom)(z),
        zoom: z,
        bbox: tileAlignedBbox(bbox, z),
        gridSize: (0, geo_1.gridSizeForZoom)(z),
    };
}
/** Stable short hash of the filter values (order-insensitive for arrays and keys). */
function filterFingerprint(f) {
    const normalized = Object.keys(f)
        .sort()
        .flatMap((k) => {
        const v = f[k];
        if (v === undefined)
            return [];
        return [[k, Array.isArray(v) ? [...v].sort() : v]];
    });
    return (0, node_crypto_1.createHash)('sha1').update(JSON.stringify(normalized)).digest('hex').slice(0, 16);
}
function mapTileCacheKey(plan, filter, version) {
    const b = plan.bbox;
    return `cache:listings:map:v${version}:${plan.kind}:${plan.zoom}:${b.swLng},${b.swLat},${b.neLng},${b.neLat}:${filterFingerprint(filter)}`;
}
//# sourceMappingURL=map-tiles.js.map