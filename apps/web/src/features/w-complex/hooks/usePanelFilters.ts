'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { parseFilters, serializeFilters } from '@/lib/map';
import { COMPLEX_PARAM, PANEL_FILTERS, type PanelFilterValues } from '../lib/filters';

/**
 * Writes a URL through the native History API. Next's router picks these calls up and re-renders
 * `useSearchParams` consumers immediately, without the server round trip of `router.push` — so
 * quick successive changes never race. The state argument must be `null`: passing the current
 * `history.state` (which carries Next's internal marker) makes the router ignore the call.
 */
function writeUrl(url: string, mode: 'push' | 'replace') {
  if (mode === 'replace') window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
}

export interface PanelUrlState {
  filters: PanelFilterValues;
  /** Patch filters. List filters push a history entry (Back undoes them); pass `replace` for view-only toggles. */
  setFilters: (patch: Partial<PanelFilterValues>, options?: { replace?: boolean }) => void;
}

/** Complex-panel filters ⇄ URL query string (`c-…` params), next to the map's own state. */
export function usePanelFilters(): PanelUrlState {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const query = searchParams.toString();
  const filters = useMemo(() => parseFilters(PANEL_FILTERS, new URLSearchParams(query)), [query]);

  const setFilters = useCallback(
    (patch: Partial<PanelFilterValues>, options?: { replace?: boolean }) => {
      // Start from the live URL so quick successive updates do not clobber each other.
      const sp = new URLSearchParams(window.location.search);
      serializeFilters(PANEL_FILTERS, { ...parseFilters(PANEL_FILTERS, sp), ...patch }, sp);
      const qs = sp.toString();
      writeUrl(qs ? `${pathname}?${qs}` : pathname, options?.replace ? 'replace' : 'push');
    },
    [pathname],
  );

  return { filters, setFilters };
}

export interface ComplexParamState {
  /** Complex id from `?complex=<id>`, or null. */
  complexId: string | null;
  /** Href of the current map URL showing `id` (panel filters reset), or without a complex for null. */
  hrefFor: (id: string | null) => string;
  /** Open another complex / close the panel (pushes a history entry). */
  setComplex: (id: string | null) => void;
}

/** `?complex=<id>` on the map route: which complex the left panel shows. */
export function useComplexParam(): ComplexParamState {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const query = searchParams.toString();
  const complexId = searchParams.get(COMPLEX_PARAM) || null;

  const hrefFor = useCallback(
    (id: string | null) => {
      const sp = new URLSearchParams(query);
      for (const key of Object.keys(PANEL_FILTERS)) sp.delete(key);
      if (id) sp.set(COMPLEX_PARAM, id);
      else sp.delete(COMPLEX_PARAM);
      const qs = sp.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, query],
  );
  const setComplex = useCallback((id: string | null) => writeUrl(hrefFor(id), 'push'), [hrefFor]);
  return { complexId, hrefFor, setComplex };
}
