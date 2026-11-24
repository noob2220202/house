"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.regionCodePrefixes = regionCodePrefixes;
const shared_1 = require("@house/shared");
/**
 * 법정동 codes are hierarchical by prefix (시도 2 / 시군구 5 / 읍면동 8 / 리 10 digits), so a banner
 * targeting "12150" matches a context of "1215010100". Returns every ancestor code of the inputs
 * (legacy 46150… codes are canonicalized first, like every stored code).
 */
function regionCodePrefixes(codes) {
    const out = new Set();
    for (const code of codes) {
        if (!code || !shared_1.REGION_CODE_PATTERN.test(code))
            continue;
        const canonical = (0, shared_1.canonicalRegionCode)(code);
        for (const len of [2, 5, 8, 10]) {
            if (canonical.length >= len)
                out.add(canonical.slice(0, len));
        }
    }
    return [...out].sort();
}
//# sourceMappingURL=targeting.js.map