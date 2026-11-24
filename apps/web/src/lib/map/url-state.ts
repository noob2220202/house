import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, clampZoom, roundCoord } from './geo';
import type { MapViewState } from './types';

/**
 * Map state lives in the URL query string so it is shareable and back-button friendly:
 *   ?c=34.95064,127.48721&z=14&sel=<markerId>&deal=SALE,JEONSE&priceMin=30000
 * `c` = center "lat,lng", `z` = zoom, `sel` = selected marker/complex id, everything else = filters.
 */
export const MAP_PARAM = { center: 'c', zoom: 'z', selected: 'sel' } as const;

type ParamSource = URLSearchParams | { get(name: string): string | null };

// ---- filters -----------------------------------------------------------------------------------

export type FilterField =
  | { type: 'string'; default?: string | null }
  | { type: 'number'; default?: number | null }
  | { type: 'boolean'; default?: boolean }
  | { type: 'csv'; default?: readonly string[] };

export type FilterSpec = Record<string, FilterField>;

export type FilterValue<F extends FilterField> = F extends { type: 'number' }
  ? number | null
  : F extends { type: 'boolean' }
    ? boolean
    : F extends { type: 'csv' }
      ? string[]
      : string | null;
export type FilterValues<S extends FilterSpec> = { [K in keyof S]: FilterValue<S[K]> };

function defaultOf(field: FilterField): string | number | boolean | string[] | null {
  switch (field.type) {
    case 'csv':
      return [...(field.default ?? [])];
    case 'boolean':
      return field.default ?? false;
    default:
      return field.default ?? null;
  }
}

/** Declares the filters of a map page: `const FILTERS = defineFilters({ deal: { type: 'csv' }, priceMin: { type: 'number' } })`. */
export function defineFilters<S extends FilterSpec>(spec: S): S {
  return spec;
}

export function defaultFilters<S extends FilterSpec>(spec: S): FilterValues<S> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(spec)) out[key] = defaultOf(field);
  return out as FilterValues<S>;
}

/** Reads filters from the query string; missing/invalid values fall back to the defaults. */
export function parseFilters<S extends FilterSpec>(spec: S, params: ParamSource): FilterValues<S> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(spec)) {
    const raw = params.get(key);
    if (raw === null || raw === '') {
      out[key] = defaultOf(field);
      continue;
    }
    switch (field.type) {
      case 'number': {
        const n = Number(raw);
        out[key] = Number.isFinite(n) ? n : defaultOf(field);
        break;
      }
      case 'boolean':
        out[key] = raw === '1' || raw === 'true';
        break;
      case 'csv':
        out[key] = raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      default:
        out[key] = raw;
    }
  }
  return out as FilterValues<S>;
}

const sameArray = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** Writes filters into `into` — values equal to their default are omitted to keep URLs short. */
export function serializeFilters<S extends FilterSpec>(
  spec: S,
  values: Partial<FilterValues<S>>,
  into = new URLSearchParams(),
): URLSearchParams {
  for (const [key, field] of Object.entries(spec)) {
    const value = (values as Record<string, unknown>)[key];
    const def = defaultOf(field);
    into.delete(key);
    if (value === undefined || value === null || value === '') continue;
    if (field.type === 'csv') {
      const arr = value as string[];
      if (arr.length > 0 && !sameArray(arr, def as string[])) into.set(key, arr.join(','));
    } else if (field.type === 'boolean') {
      if (value !== def) into.set(key, value ? '1' : '0');
    } else if (value !== def) {
      into.set(key, typeof value === 'number' ? String(value) : (value as string));
    }
  }
  return into;
}

/** Number of filters that differ from their defaults (badge on the mobile filter button). */
export function countActiveFilters<S extends FilterSpec>(spec: S, values: FilterValues<S>): number {
  return serializeFilters(spec, values).size;
}

// ---- view --------------------------------------------------------------------------------------

export function parseMapView(
  params: ParamSource,
  fallback: MapViewState = { center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM },
): MapViewState {
  let center = fallback.center;
  const c = params.get(MAP_PARAM.center);
  if (c) {
    const [lat, lng] = c.split(',').map(Number);
    if (
      lat !== undefined &&
      lng !== undefined &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= 33 &&
      lat <= 39 &&
      lng >= 124 &&
      lng <= 132
    )
      center = { lat, lng };
  }
  const z = Number(params.get(MAP_PARAM.zoom));
  const zoom =
    params.get(MAP_PARAM.zoom) !== null && Number.isFinite(z) ? clampZoom(z) : fallback.zoom;
  return { center, zoom };
}

export function serializeMapView(
  view: MapViewState,
  into = new URLSearchParams(),
): URLSearchParams {
  into.set(MAP_PARAM.center, `${roundCoord(view.center.lat)},${roundCoord(view.center.lng)}`);
  into.set(MAP_PARAM.zoom, String(Math.round(view.zoom * 100) / 100));
  return into;
}

export function parseSelected(params: ParamSource): string | null {
  return params.get(MAP_PARAM.selected) || null;
}

/** Builds a shareable map URL: `buildMapHref('/map/apt', { view, selected, spec, filters })`. */
export function buildMapHref<S extends FilterSpec>(
  pathname: string,
  state: {
    view?: MapViewState;
    selected?: string | null;
    spec?: S;
    filters?: Partial<FilterValues<S>>;
  },
): string {
  const sp = new URLSearchParams();
  if (state.view) serializeMapView(state.view, sp);
  if (state.selected) sp.set(MAP_PARAM.selected, state.selected);
  if (state.spec && state.filters) serializeFilters(state.spec, state.filters, sp);
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
