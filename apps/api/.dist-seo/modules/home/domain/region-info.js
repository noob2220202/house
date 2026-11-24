"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.regionInfoIndex = regionInfoIndex;
/**
 * Indexes the service region's 읍면동 / 리 rows by region key. 읍면동 rows may be stored with 8
 * digits (행안부 list) or 10 digits ending in 00 (Kakao bcode); both map to the 8-digit key.
 */
function regionInfoIndex(regions) {
    const byCode = new Map(regions.map((r) => [r.code, r]));
    const out = new Map();
    for (const r of regions) {
        const key = r.code.length === 10 && r.code.endsWith('00') ? r.code.slice(0, 8) : r.code;
        if (out.has(key) && key !== r.code)
            continue; // the 8-digit row wins
        const parent = r.level === 'RI' && r.parentCode ? byCode.get(r.parentCode) : undefined;
        out.set(key, {
            name: r.name,
            emdName: parent ? `${parent.name} ${r.name}` : r.name,
            parentName: parent?.name ?? null,
            lat: r.lat,
            lng: r.lng,
        });
    }
    return out;
}
//# sourceMappingURL=region-info.js.map