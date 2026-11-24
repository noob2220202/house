/**
 * Backslashes and control / invisible separator characters: browsers normalize `/\evil.com` to
 * `//evil.com` and strip tab / newline inside URLs (`/\t/evil.com` → `//evil.com`), which would
 * turn a "site-relative" link into an off-site one.
 */
// eslint-disable-next-line no-control-regex
const UNSAFE_LINK_CHARS = /[\\\u0000-\u001f\u007f-\u009f\u2028\u2029\ufeff]/;

/**
 * Accepts only absolute http(s) URLs (or site-relative paths starting with a single "/").
 * Backslashes and control characters are rejected anywhere in the value.
 */
export function isSafeLinkUrl(value: string): boolean {
  if (UNSAFE_LINK_CHARS.test(value)) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.length > 0;
  } catch {
    return false;
  }
}

/** Extracts the 11-char YouTube video id from common URL shapes. */
export function parseYoutubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.slice(1);
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else {
        const m = /^\/(?:embed|shorts|live)\/([^/?#]+)/.exec(u.pathname);
        id = m?.[1] ?? null;
      }
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
