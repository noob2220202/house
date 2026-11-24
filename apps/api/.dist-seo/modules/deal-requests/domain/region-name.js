"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.regionNameCandidates = regionNameCandidates;
exports.regionNameOf = regionNameOf;
/**
 * Codes under which a 법정동 may be stored: the code itself, its 8-digit 읍면동 prefix and that
 * prefix padded to 10 digits (regions holds 읍면동 rows as 8- or 10-digit codes).
 */
function regionNameCandidates(code) {
    const emd8 = code.slice(0, 8);
    return [...new Set([code, emd8, `${emd8}00`])].filter((c) => c.length >= 8);
}
/**
 * Display name of a 법정동 code: the 읍면동 ("조례동"), "읍면 리" for a 리 ("해룡면 신대리"); a 리
 * code without its own row falls back to the 읍면동. Null when unknown or shorter than 8 digits.
 */
function regionNameOf(code, byCode) {
    if (!code || code.length < 8)
        return null;
    const exact = byCode.get(code);
    if (exact?.level === 'RI')
        return exact.parent ? `${exact.parent.name} ${exact.name}` : exact.name;
    if (exact)
        return exact.name;
    for (const c of regionNameCandidates(code)) {
        const row = byCode.get(c);
        if (row && row.level !== 'RI')
            return row.name;
    }
    return null;
}
//# sourceMappingURL=region-name.js.map