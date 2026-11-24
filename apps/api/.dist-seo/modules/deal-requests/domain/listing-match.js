"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchScore = matchScore;
exports.rankByMatch = rankByMatch;
const shared_1 = require("@house/shared");
const has = (n) => typeof n === 'number';
/** true = inside, false = outside, null = no bound stated. */
function within(value, min, max) {
    if (!has(min) && !has(max))
        return null;
    if (!has(value))
        return false;
    return (!has(min) || value >= min) && (!has(max) || value <= max);
}
function regionOk(r, l) {
    if (r.type === shared_1.DealRequestType.SELL_OR_LEASE) {
        // Comparable listings: same complex first, then the same 읍면동.
        if (r.complexId && l.complexId === r.complexId)
            return true;
        if (!r.emdCode)
            return null;
        return !!l.emdCode && l.emdCode.slice(0, 8) === r.emdCode.slice(0, 8);
    }
    if (l.complexId && r.complexIds.includes(l.complexId))
        return true;
    if (r.regionCodes.length === 0 && r.complexIds.length === 0)
        return null;
    return !!l.emdCode && r.regionCodes.some((c) => l.emdCode.startsWith(c));
}
function budgetOk(r, l) {
    if (r.type === shared_1.DealRequestType.SELL_OR_LEASE)
        return null;
    if (l.dealType === shared_1.DealType.MONTHLY) {
        const deposit = within(l.deposit, r.depositMin, r.depositMax);
        const rent = within(l.monthlyRent, r.rentMin, r.rentMax);
        if (deposit === null && rent === null)
            return null;
        return deposit !== false && rent !== false;
    }
    if (l.dealType === shared_1.DealType.JEONSE)
        return within(l.price, r.depositMin, r.depositMax);
    return within(l.price, r.priceMin, r.priceMax);
}
/**
 * How well one of the agency's listings fits a request: the number of satisfied conditions
 * (asset type, deal type, region / complex, budget, area, rooms) and whether all stated ones
 * are. Same rule as the web picker
 * (`a-inbox/lib/match.ts`), so the server order and the "조건 일치" hint agree. A hint, never a
 * filter: every active listing may be attached.
 */
function matchScore(r, l) {
    const checks = [
        l.assetType === r.assetType,
        r.dealTypes.includes(l.dealType),
        regionOk(r, l),
        budgetOk(r, l),
        r.type === shared_1.DealRequestType.WANTED ? within(l.exclusiveArea, r.areaMin, r.areaMax) : null,
        r.type === shared_1.DealRequestType.WANTED && has(r.roomsMin)
            ? has(l.rooms) && l.rooms >= r.roomsMin
            : null,
    ];
    const stated = checks.filter((c) => c !== null);
    const score = stated.filter((c) => c).length;
    return { full: stated.length > 0 && score === stated.length, score };
}
/** Full matches first, then by score; ties keep the incoming order (stable sort). */
function rankByMatch(r, listings) {
    return listings
        .map((listing, index) => ({ listing, m: matchScore(r, listing), index }))
        .sort((a, b) => Number(b.m.full) - Number(a.m.full) || b.m.score - a.m.score || a.index - b.index)
        .map((x) => x.listing);
}
//# sourceMappingURL=listing-match.js.map