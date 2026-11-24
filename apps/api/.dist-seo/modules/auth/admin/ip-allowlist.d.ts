/** "::ffff:10.0.0.1" → "10.0.0.1" (Express reports IPv4 clients on dual-stack sockets this way). */
export declare function normalizeIp(ip: string): string;
/**
 * IP allowlist from entries like "203.0.113.7", "10.0.0.0/8", "2001:db8::/32".
 * An empty list allows everything (the feature is optional). Invalid entries throw at build time,
 * so a typo in ADMIN_IP_ALLOWLIST fails loudly instead of silently locking everyone out or in.
 */
export declare class IpAllowlist {
    private readonly list;
    readonly size: number;
    constructor(entries: readonly string[]);
    allows(ip: string | null | undefined): boolean;
}
export declare function ipAllowed(entries: readonly string[] | undefined, ip: string | null | undefined): boolean;
/**
 * Lockout bucket for a client address: an IPv4 address as is, an IPv6 address by its /64 (one
 * subscriber's prefix, whose addresses a single client can rotate through freely).
 */
export declare function clientIpBucket(ip: string | null | undefined): string;
