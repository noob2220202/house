"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.anonymousIdentity = anonymousIdentity;
exports.isTopLevelNavigation = isTopLevelNavigation;
const node_net_1 = require("node:net");
/**
 * Identity of an anonymous visitor for ad dedup: the IPv4 address, or the /64 prefix of an IPv6
 * address (one subscriber usually owns a whole /64). The User-Agent is deliberately not part of
 * it: rotating the UA must not mint new visitors. Null when the address is missing or invalid.
 */
function anonymousIdentity(ip) {
    if (!ip)
        return null;
    const raw = ip
        .trim()
        .replace(/^\[|\]$/g, '')
        .split('%')[0] ?? '';
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(raw);
    if (mapped?.[1] && (0, node_net_1.isIP)(mapped[1]) === 4)
        return `a4:${mapped[1]}`;
    const kind = (0, node_net_1.isIP)(raw);
    if (kind === 4)
        return `a4:${raw}`;
    if (kind === 6) {
        const groups = expandIpv6(raw);
        return groups ? `a6:${groups.slice(0, 4).join(':')}::/64` : null;
    }
    return null;
}
/** The 8 hextets of a valid IPv6 address (lowercase, no leading zeros). */
function expandIpv6(addr) {
    let s = addr.toLowerCase();
    // Trailing embedded IPv4 (e.g. 64:ff9b::1.2.3.4) → two hextets.
    const v4 = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
    if (v4) {
        const [a, b, c, d] = v4.slice(1).map(Number);
        s = `${s.slice(0, v4.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
    }
    const [head = '', tail] = s.split('::');
    const left = head ? head.split(':') : [];
    const right = tail ? tail.split(':') : [];
    const missing = 8 - left.length - right.length;
    if (tail === undefined ? missing !== 0 : missing < 1)
        return null;
    const all = [...left, ...Array(tail === undefined ? 0 : missing).fill('0'), ...right];
    return all.map((h) => parseInt(h || '0', 16).toString(16));
}
/**
 * Clicks only count for top-level navigations. Browsers send Fetch Metadata on every request;
 * an `<img src=".../click">` or `fetch()` embedded on a third-party page arrives with
 * `Sec-Fetch-Dest: image|empty` / `Sec-Fetch-Mode: no-cors|cors` and must not inflate clicks.
 * Absent headers (older browsers) are accepted.
 */
function isTopLevelNavigation(fetchDest, fetchMode) {
    if (fetchDest && fetchDest.toLowerCase() !== 'document')
        return false;
    if (fetchMode && fetchMode.toLowerCase() !== 'navigate')
        return false;
    return true;
}
//# sourceMappingURL=visitor.js.map