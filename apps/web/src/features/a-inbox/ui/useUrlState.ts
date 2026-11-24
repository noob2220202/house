'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * List filters kept in the query string. `parse` reads them from the current URL and `serialize`
 * writes them back ("?stage=new").
 *
 * Writes are shallow (`history.pushState` / `replaceState`, which Next keeps in sync with
 * `useSearchParams`): the console pages are dynamic, so a router navigation would re-run the
 * layout's session and agency requests on the server for every filter click. A change pushes a
 * history entry (the back button undoes a filter) unless `replace` is set.
 */
export function useUrlState<T>(
  parse: (params: URLSearchParams) => T,
  serialize: (state: T) => string,
): [T, (next: T, options?: { replace?: boolean }) => void] {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = searchParams.toString();
  const state = useMemo(() => parse(new URLSearchParams(key)), [key, parse]);
  const setState = useCallback(
    (next: T, options?: { replace?: boolean }) => {
      const href = `${pathname}${serialize(next)}`;
      if (href === `${window.location.pathname}${window.location.search}`) return;
      if (options?.replace) window.history.replaceState(null, '', href);
      else window.history.pushState(null, '', href);
    },
    [pathname, serialize],
  );
  return [state, setState];
}

/** After a page change the list starts over, so bring its top back into view. */
export function scrollToListTop() {
  window.scrollTo({ top: 0 });
}
