/**
 * Decides whether a link click leaves the wizard for another in-app page (so unsaved edits would be
 * lost by a client-side navigation that `beforeunload` never sees).
 *
 * Returns the site-relative URL to continue to, or null when the click does not leave: other origin,
 * new tab / download, `tel:` / `mailto:`, a hash on the same page, or the same path.
 */
export function isLeaveTarget(
  anchor: { href: string; target?: string; download?: boolean },
  current: string,
): string | null {
  if (anchor.download) return null;
  if (anchor.target && anchor.target !== '_self') return null;
  let next: URL;
  let here: URL;
  try {
    here = new URL(current);
    next = new URL(anchor.href, here);
  } catch {
    return null;
  }
  if (next.protocol !== 'http:' && next.protocol !== 'https:') return null;
  if (next.origin !== here.origin) return null;
  if (next.pathname === here.pathname) return null;
  return `${next.pathname}${next.search}${next.hash}`;
}
