'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export type UrlPatch = Record<string, string | number | null | undefined>;

/** Applies a patch to a query string: `null` / `undefined` / `''` remove the key. */
export function patchQuery(current: string, patch: UrlPatch): string {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === '') next.delete(key);
    else next.set(key, String(value));
  }
  return next.toString();
}

/**
 * Screen state in the query string (filters, page, open editor) so views are shareable and the back
 * button works. `set({ page: null })` removes a key; `push: true` adds a history entry.
 *
 * Uses the native History API, which the App Router keeps in sync with `useSearchParams`: the state
 * is client-only (the routes render the same shell for every query), so there is no reason to pay a
 * server round-trip per filter change like `router.replace` would.
 */
export function useUrlState() {
  const pathname = usePathname();
  const params = useSearchParams();

  const hrefWith = useCallback(
    (patch: UrlPatch) => {
      const qs = patchQuery(params.toString(), patch);
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [params, pathname],
  );

  const set = useCallback(
    (patch: UrlPatch, options: { push?: boolean } = {}) => {
      const href = hrefWith(patch);
      if (options.push) window.history.pushState(null, '', href);
      else window.history.replaceState(null, '', href);
    },
    [hrefWith],
  );

  return { params, set, hrefWith };
}
