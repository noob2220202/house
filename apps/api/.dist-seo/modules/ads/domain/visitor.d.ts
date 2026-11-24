/**
 * Identity of an anonymous visitor for ad dedup: the IPv4 address, or the /64 prefix of an IPv6
 * address (one subscriber usually owns a whole /64). The User-Agent is deliberately not part of
 * it: rotating the UA must not mint new visitors. Null when the address is missing or invalid.
 */
export declare function anonymousIdentity(ip: string | null | undefined): string | null;
/**
 * Clicks only count for top-level navigations. Browsers send Fetch Metadata on every request;
 * an `<img src=".../click">` or `fetch()` embedded on a third-party page arrives with
 * `Sec-Fetch-Dest: image|empty` / `Sec-Fetch-Mode: no-cors|cors` and must not inflate clicks.
 * Absent headers (older browsers) are accepted.
 */
export declare function isTopLevelNavigation(fetchDest: string | null | undefined, fetchMode: string | null | undefined): boolean;
