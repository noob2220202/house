'use client';
import { type ListingSort } from '@house/shared';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import {
  MAP_PARAM,
  defineFilters,
  parseFilters,
  parseMapView,
  parseSelected,
  serializeFilters,
  serializeMapView,
  type FilterValues,
  type MapViewState,
} from '@/lib/map';
import { COMPLEX_PARAM, PANEL_FILTERS } from '@/features/w-complex/lib/filters';
import type { AreaUnit } from '@/lib/format';
import type { AssetConfig } from '../config/assets';
import { FILTER_SPEC, assetKeys, type MapFilters } from './filters';

/** View options that are not filters (they never reach the API as filters). */
export const UI_SPEC = defineFilters({
  /** ListingSort of the side list. */
  sort: { type: 'string' },
  /** 아파트 panel tab: popular | recent | favorite. */
  tab: { type: 'string', default: 'popular' },
  /** 평 / ㎡. */
  unit: { type: 'string' },
  /** Listing cards: card | list. */
  view: { type: 'string', default: 'card' },
  /** Map layer: trade (실거래가 on the markers). */
  layer: { type: 'string' },
  /** The selected complex's listings are open in the side panel. */
  list: { type: 'boolean' },
});
type RawUi = FilterValues<typeof UI_SPEC>;

export type PanelTab = 'popular' | 'recent' | 'favorite';

export interface MapUi {
  sort: ListingSort;
  tab: PanelTab;
  unit: AreaUnit;
  view: 'card' | 'list';
  tradeLayer: boolean;
  listOpen: boolean;
}

export function normalizeUi(raw: RawUi, asset: AssetConfig): MapUi {
  const sorts = asset.sorts.flatMap((s) => (s.alt ? [s.value, s.alt] : [s.value]));
  const sort = sorts.find((s) => s === raw.sort) ?? asset.defaultSort;
  return {
    sort,
    tab: raw.tab === 'recent' || raw.tab === 'favorite' ? raw.tab : 'popular',
    unit: raw.unit === 'pyeong' || raw.unit === 'sqm' ? raw.unit : asset.defaultUnit,
    view: raw.view === 'list' ? 'list' : 'card',
    tradeLayer: raw.layer === 'trade',
    listOpen: raw.list,
  };
}

export interface MapPageState {
  view: MapViewState;
  selected: string | null;
  filters: MapFilters;
  ui: MapUi;
  /** Pan / zoom → replaceState (no history spam). */
  setView: (view: MapViewState) => void;
  /**
   * Select a marker / card → new history entry so Back closes it. `view` moves the map in the same
   * entry; `complex` also opens that complex's panel (w-complex `?complex=`). Deselecting always
   * closes the complex panel.
   */
  select: (
    id: string | null,
    options?: { view?: MapViewState; listOpen?: boolean; complex?: boolean },
  ) => void;
  /** Patch filters → new history entry (`replace` while dragging). */
  setFilters: (patch: Partial<MapFilters>, options?: { replace?: boolean }) => void;
  resetFilters: () => void;
  setUi: (
    patch: Partial<{
      sort: ListingSort;
      tab: PanelTab;
      unit: AreaUnit;
      view: 'card' | 'list';
      tradeLayer: boolean;
      listOpen: boolean;
    }>,
  ) => void;
}

/**
 * Whole map page state ⇄ URL query string: view (c, z), selection (sel), filters (API names) and
 * view options. Uses history.pushState / replaceState, which Next syncs into `useSearchParams`
 * without a server round trip — pans and filter changes stay instant.
 */
export function useMapPageState(asset: AssetConfig, fallbackView: MapViewState): MapPageState {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const query = searchParams.toString();

  const view = useMemo(
    () => parseMapView(new URLSearchParams(query), fallbackView),
    [query, fallbackView],
  );
  const selected = useMemo(() => parseSelected(new URLSearchParams(query)), [query]);
  const filters = useMemo(() => parseFilters(FILTER_SPEC, new URLSearchParams(query)), [query]);
  const ui = useMemo(
    () => normalizeUi(parseFilters(UI_SPEC, new URLSearchParams(query)), asset),
    [query, asset],
  );

  const write = useCallback(
    (mutate: (sp: URLSearchParams) => void, mode: 'push' | 'replace') => {
      // Start from the live URL so rapid successive updates never clobber each other.
      const sp = new URLSearchParams(window.location.search);
      mutate(sp);
      const qs = sp.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (url === `${window.location.pathname}${window.location.search}`) return;
      if (mode === 'replace') window.history.replaceState(null, '', url);
      else window.history.pushState(null, '', url);
    },
    [pathname],
  );

  const setView = useCallback(
    (next: MapViewState) => write((sp) => void serializeMapView(next, sp), 'replace'),
    [write],
  );

  const select = useCallback<MapPageState['select']>(
    (id, options) =>
      write((sp) => {
        if (id) sp.set(MAP_PARAM.selected, id);
        else sp.delete(MAP_PARAM.selected);
        if (options?.view) serializeMapView(options.view, sp);
        if (options?.listOpen) sp.set('list', '1');
        else sp.delete('list');
        if (!id || options?.complex) {
          // Switching complexes starts from a clean panel (its `c-…` filters belong to the old one).
          for (const key of Object.keys(PANEL_FILTERS)) sp.delete(key);
          if (id) sp.set(COMPLEX_PARAM, id);
          else sp.delete(COMPLEX_PARAM);
        }
      }, 'push'),
    [write],
  );

  const setFilters = useCallback<MapPageState['setFilters']>(
    (patch, options) =>
      write(
        (sp) => {
          const current = parseFilters(FILTER_SPEC, sp);
          serializeFilters(FILTER_SPEC, { ...current, ...patch }, sp);
        },
        options?.replace ? 'replace' : 'push',
      ),
    [write],
  );

  const resetFilters = useCallback(
    () =>
      write((sp) => {
        for (const key of assetKeys(asset)) sp.delete(key);
        for (const key of Object.keys(FILTER_SPEC)) sp.delete(key);
      }, 'push'),
    [asset, write],
  );

  const setUi = useCallback<MapPageState['setUi']>(
    (patch) =>
      write((sp) => {
        const set = (key: string, value: string | null) => {
          if (value === null) sp.delete(key);
          else sp.set(key, value);
        };
        if (patch.sort !== undefined)
          set('sort', patch.sort === asset.defaultSort ? null : patch.sort);
        if (patch.tab !== undefined) set('tab', patch.tab === 'popular' ? null : patch.tab);
        if (patch.unit !== undefined)
          set('unit', patch.unit === asset.defaultUnit ? null : patch.unit);
        if (patch.view !== undefined) set('view', patch.view === 'card' ? null : patch.view);
        if (patch.tradeLayer !== undefined) set('layer', patch.tradeLayer ? 'trade' : null);
        if (patch.listOpen !== undefined) set('list', patch.listOpen ? '1' : null);
      }, 'replace'),
    [asset, write],
  );

  return { view, selected, filters, ui, setView, select, setFilters, resetFilters, setUi };
}
