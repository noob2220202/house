'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import {
  MAP_PARAM,
  parseFilters,
  parseMapView,
  parseSelected,
  serializeFilters,
  serializeMapView,
  type FilterSpec,
  type FilterValues,
} from './url-state';
import type { MapViewState } from './types';

export interface MapUrlState<S extends FilterSpec> {
  view: MapViewState;
  selected: string | null;
  filters: FilterValues<S>;
  /** Pan/zoom → `history.replaceState` (no history spam, no server round trip). */
  setView: (view: MapViewState) => void;
  /** Select / deselect a marker → pushes a history entry (Back closes the panel). */
  setSelected: (id: string | null) => void;
  /** Patch filters → pushes a history entry. Pass `{ replace: true }` while dragging sliders. */
  setFilters: (patch: Partial<FilterValues<S>>, options?: { replace?: boolean }) => void;
  /** Reset all filters to their defaults (keeps the view). */
  resetFilters: () => void;
}

/**
 * Map state ⇄ URL query string. Shareable links, working Back button, state survives reloads.
 *
 *   const FILTERS = defineFilters({ deal: { type: 'csv' }, priceMax: { type: 'number' } });
 *   const { view, filters, selected, setView, setFilters, setSelected } = useMapUrlState(FILTERS);
 */
export function useMapUrlState<S extends FilterSpec>(
  spec: S,
  fallbackView?: MapViewState,
): MapUrlState<S> {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const query = searchParams.toString();

  const view = useMemo(
    () => parseMapView(new URLSearchParams(query), fallbackView),
    [query, fallbackView],
  );
  const selected = useMemo(() => parseSelected(new URLSearchParams(query)), [query]);
  const filters = useMemo(() => parseFilters(spec, new URLSearchParams(query)), [spec, query]);

  const write = useCallback(
    (mutate: (sp: URLSearchParams) => void, mode: 'push' | 'replace') => {
      // Always start from the live URL so rapid successive updates do not clobber each other.
      const sp = new URLSearchParams(window.location.search);
      mutate(sp);
      const qs = sp.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (mode === 'replace') window.history.replaceState(window.history.state, '', url);
      else router.push(url, { scroll: false });
    },
    [pathname, router],
  );

  const setView = useCallback(
    (next: MapViewState) => write((sp) => void serializeMapView(next, sp), 'replace'),
    [write],
  );
  const setSelected = useCallback(
    (id: string | null) =>
      write((sp) => {
        if (id) sp.set(MAP_PARAM.selected, id);
        else sp.delete(MAP_PARAM.selected);
      }, 'push'),
    [write],
  );
  const setFilters = useCallback(
    (patch: Partial<FilterValues<S>>, options?: { replace?: boolean }) =>
      write(
        (sp) => {
          const current = parseFilters(spec, sp);
          serializeFilters(spec, { ...current, ...patch }, sp);
        },
        options?.replace ? 'replace' : 'push',
      ),
    [spec, write],
  );
  const resetFilters = useCallback(
    () =>
      write((sp) => {
        for (const key of Object.keys(spec)) sp.delete(key);
      }, 'push'),
    [spec, write],
  );

  return { view, selected, filters, setView, setSelected, setFilters, resetFilters };
}
