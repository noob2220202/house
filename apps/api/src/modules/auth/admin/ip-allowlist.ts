import { BlockList, isIP } from 'node:net';

/** "::ffff:10.0.0.1" → "10.0.0.1" (Express reports IPv4 clients on dual-stack sockets this way). */
export function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(trimmed);
  return mapped?.[1] ?? trimmed;
}

/**
 * IP allowlist from entries like "203.0.113.7", "10.0.0.0/8", "2001:db8::/32".
 * An empty list allows everything (the feature is optional). Invalid entries throw at build time,
 * so a typo in ADMIN_IP_ALLOWLIST fails loudly instead of silently locking everyone out or in.
 */
export class IpAllowlist {
  private readonly list = new BlockList();
  readonly size: number;

  constructor(entries: readonly string[]) {
    this.size = entries.length;
    for (const raw of entries) {
      const entry = raw.trim();
      const [addr = '', prefixRaw] = entry.split('/');
      const ip = normalizeIp(addr);
      const family = isIP(ip);
      if (family === 0) throw new Error(`Invalid IP allowlist entry: "${entry}"`);
      const type = family === 4 ? 'ipv4' : 'ipv6';
      if (prefixRaw === undefined) {
        this.list.addAddress(ip, type);
        continue;
      }
      const prefix = Number(prefixRaw);
      const max = family === 4 ? 32 : 128;
      if (!/^\d+$/.test(prefixRaw) || prefix < 0 || prefix > max) {
        throw new Error(`Invalid IP allowlist prefix: "${entry}"`);
      }
      this.list.addSubnet(ip, prefix, type);
    }
  }

  allows(ip: string | null | undefined): boolean {
    if (this.size === 0) return true;
    if (!ip) return false;
    const normalized = normalizeIp(ip);
    const family = isIP(normalized);
    if (family === 0) return false;
    return this.list.check(normalized, family === 4 ? 'ipv4' : 'ipv6');
  }
}

export function ipAllowed(entries: readonly string[] | undefined, ip: string | null | undefined) {
  if (!entries || entries.length === 0) return true;
  try {
    return new IpAllowlist(entries).allows(ip);
  } catch {
    // A malformed per-account entry must never open access.
    return false;
  }
}

/**
 * Lockout bucket for a client address: an IPv4 address as is, an IPv6 address by its /64 (one
 * subscriber's prefix, whose addresses a single client can rotate through freely).
 */
export function clientIpBucket(ip: string | null | undefined): string {
  if (!ip) return 'unknown';
  const addr = normalizeIp(ip).split('%')[0] ?? '';
  const family = isIP(addr);
  if (family === 4) return addr;
  if (family !== 6) return 'unknown';
  return `${expandIpv6(addr).slice(0, 4).join(':')}::/64`;
}

/** A valid IPv6 address → its 8 hextets (lowercase, no leading zeros). */
function expandIpv6(ip: string): string[] {
  let s = ip.toLowerCase();
  const v4 = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number) as [number, number, number, number];
    s = `${s.slice(0, v4.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head = '', tail] = s.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const fill = tail === undefined ? [] : Array<string>(8 - h.length - t.length).fill('0');
  return [...h, ...fill, ...t].map((g) => parseInt(g, 16).toString(16));
}
