'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import type { MapViewState } from '@/lib/map/types';
import {
  MAP_PARAM,
  parseFilters,
  parseMapView,
  parseSelected,
  serializeFilters,
  serializeMapView,
} from '@/lib/map/url-state';
import { AGENCY_FILTERS, type AgencyFilters } from './filters';

export interface AgencyUrlPatch {
  view?: MapViewState;
  /** `null` closes the profile. */
  selected?: string | null;
  filters?: Partial<AgencyFilters>;
  /** Reset every filter to its default before applying `filters`. */
  resetFilters?: boolean;
}

/**
 * State of /agencies ⇄ query string (`c`, `z`, `sel` + filters), in the same format as the
 * shared `useMapUrlState`. Differences that matter for this screen:
 *  - one `update()` applies view + selection + filters together (select a card = pan + open panel);
 *  - writes go through `history.pushState/replaceState`, which Next keeps in sync with
 *    `useSearchParams` without re-rendering the server page, and which are synchronous, so quick
 *    successive updates (pan right after a click) can never overwrite each other.
 * `push` adds a history entry (Back closes the panel / undoes a filter); `replace` is for panning.
 */
export function useAgencyUrlState(fallbackView: MapViewState) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  const view = useMemo(
    () => parseMapView(new URLSearchParams(query), fallbackView),
    [query, fallbackView],
  );
  const selected = useMemo(() => parseSelected(new URLSearchParams(query)), [query]);
  const filters = useMemo(() => parseFilters(AGENCY_FILTERS, new URLSearchParams(query)), [query]);

  const update = useCallback(
    (patch: AgencyUrlPatch, mode: 'push' | 'replace' = 'push') => {
      const sp = new URLSearchParams(window.location.search);
      const before = sp.toString();
      if (patch.view) serializeMapView(patch.view, sp);
      if (patch.selected !== undefined) {
        if (patch.selected) sp.set(MAP_PARAM.selected, patch.selected);
        else sp.delete(MAP_PARAM.selected);
      }
      if (patch.resetFilters) for (const key of Object.keys(AGENCY_FILTERS)) sp.delete(key);
      if (patch.filters)
        serializeFilters(
          AGENCY_FILTERS,
          { ...parseFilters(AGENCY_FILTERS, sp), ...patch.filters },
          sp,
        );
      const qs = sp.toString();
      if (qs === before) return;
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (mode === 'push') window.history.pushState(null, '', url);
      else window.history.replaceState(null, '', url);
    },
    [pathname],
  );

  return { view, selected, filters, update };
}
