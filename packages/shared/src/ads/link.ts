/** Characters that must never appear in an ad link (whitespace, control chars, backslash). */
// eslint-disable-next-line no-control-regex
const FORBIDDEN_LINK_CHARS = /[\u0000-\u0020\u007f-\u00a0\\\u2028\u2029\ufeff]/;
const PROBE_ORIGIN = 'https://probe.invalid';

/**
 * Banner/popup link rule (stricter than `isSafeLinkUrl`): an absolute `https:` URL without
 * credentials, or a site-relative path starting with exactly one "/". Backslashes, whitespace and
 * control characters are rejected because browsers normalize `/\evil.com` to `//evil.com`.
 */
export function isSafeAdLinkUrl(value: string): boolean {
  if (value.length === 0 || value.length > 2000 || FORBIDDEN_LINK_CHARS.test(value)) return false;
  if (value.startsWith('/')) {
    if (value.startsWith('//')) return false;
    try {
      return new URL(value, PROBE_ORIGIN).origin === PROBE_ORIGIN;
    } catch {
      return false;
    }
  }
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname.length > 0 && !u.username && !u.password;
  } catch {
    return false;
  }
}

/**
 * Absolute redirect target for a stored ad link: site-relative paths resolve against the public
 * site origin. Returns null for links that fail `isSafeAdLinkUrl` (re-checked on every click).
 */
export function resolveAdLink(link: string, publicBaseUrl: string): string | null {
  if (!isSafeAdLinkUrl(link)) return null;
  if (!link.startsWith('/')) return new URL(link).toString();
  const base = new URL(publicBaseUrl);
  const resolved = new URL(link, base.origin);
  return resolved.origin === base.origin ? resolved.toString() : null;
}
