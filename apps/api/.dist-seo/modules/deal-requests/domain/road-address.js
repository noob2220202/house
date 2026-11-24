"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roadKey = roadKey;
exports.roadNameOf = roadNameOf;
exports.nameKey = nameKey;
/**
 * "전남 순천시 해룡면 신대2로 40 (신대리)" → "신대2로40": the road name + building number, which
 * identify a building whatever the 시도 / 시군구 spelling (전남 / 전라남도 / 전남광주통합특별시,
 * 46150 → 12150) or trailing extras (동, 참고항목). Null when no "…로|길 <번호>" part is found.
 */
function roadKey(address) {
    const last = lastRoadMatch(address);
    return last ? `${last[1]}${last[2]}` : null;
}
/** "왕지로 12번길 3" is written both with and without the space before "12번길". */
function lastRoadMatch(address) {
    if (!address)
        return null;
    const text = address.replace(/(로|길)\s+(\d+번?길)/g, '$1$2');
    const re = /([0-9A-Za-z가-힣.·]+(?:로|길))\s*(\d+(?:-\d+)?)(?![0-9]*번?길)/g;
    let last = null;
    for (let m = re.exec(text); m; m = re.exec(text))
        last = m;
    return last;
}
/** Road name of a road key ("신대2로40" → "신대2로"), used to narrow the DB lookup. */
function roadNameOf(address) {
    return lastRoadMatch(address)?.[1] ?? null;
}
/** "레이크파크 1단지" → "레이크파크1단지": building names compared without spaces / punctuation. */
function nameKey(name) {
    return (name ?? '').replace(/[\s()·.,-]/g, '').toLowerCase();
}
//# sourceMappingURL=road-address.js.map