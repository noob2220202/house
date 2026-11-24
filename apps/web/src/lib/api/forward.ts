import { isIP } from 'node:net';

/**
 * Headers the Next server adds to its own (server-side) API calls.
 *
 * SSR calls go straight to INTERNAL_API_URL on loopback, so without help the API would see every
 * one of them as 127.0.0.1 / "node": one shared rate-limit bucket for all anonymous visitors, and
 * visitor/view counters that cannot tell people apart.
 *
 * - `x-house-ssr: 1` marks every server-side call (cached or not). nginx strips a client-supplied
 *   copy (deploy/nginx/snippets/house-proxy.conf), so on loopback it can only come from Next.
 * - Per-request (uncached) calls also carry the visitor: `x-forwarded-for` and `user-agent`.
 *   Cached reads never do — their response is shared by every visitor, and Next keys its fetch
 *   cache on the request headers, so a per-visitor header would create one cache entry per IP.
 *
 * The visitor IP is taken from `X-Real-IP`, which nginx sets to `$remote_addr` (it overwrites any
 * client value). A request without it did not come through nginx (dev, e2e, a direct hit on the
 * loopback port): its `X-Forwarded-For` is whatever the client sent, so nothing is forwarded.
 */
export const SSR_HEADER = 'x-house-ssr';

/** Header names are lower-case: fetch normalizes them, and Next's fetch cache keys on them. */
export const SSR_MARKER: Readonly<Record<string, string>> = Object.freeze({ [SSR_HEADER]: '1' });

const MAX_USER_AGENT = 512;

export interface HeaderSource {
  get(name: string): string | null;
}

/** The visitor's IP as set by nginx (`X-Real-IP`), or null when the request did not pass nginx. */
export function visitorIp(incoming: HeaderSource): string | null {
  const raw = incoming.get('x-real-ip')?.trim();
  if (!raw) return null;
  return isIP(raw) ? raw : null;
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

/** The browser's User-Agent, capped and stripped of control characters (or null). */
export function visitorUserAgent(incoming: HeaderSource): string | null {
  const ua = incoming.get('user-agent')?.replace(CONTROL_CHARS, '').trim();
  return ua ? ua.slice(0, MAX_USER_AGENT) : null;
}

/** Headers of a per-request (uncached) server-side API call made on behalf of `incoming`. */
export function visitorHeaders(incoming: HeaderSource): Record<string, string> {
  const out: Record<string, string> = { ...SSR_MARKER };
  const ip = visitorIp(incoming);
  if (ip) out['x-forwarded-for'] = ip;
  const ua = visitorUserAgent(incoming);
  if (ua) out['user-agent'] = ua;
  return out;
}
