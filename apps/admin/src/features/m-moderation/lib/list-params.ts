/**
 * URL query state of a moderation list (tab, filters, search, page) — pure helpers so the lists are
 * shareable and back-button friendly. The hook lives in `use-list-params.ts`.
 */
export type ParamDef =
  /** Free text (search box). Trimmed, max 50 chars. */
  | { kind: 'text' }
  /** One of `values`; anything else falls back to `fallback` (default: '' = 전체). */
  | { kind: 'enum'; values: readonly string[]; fallback?: string }
  /** Boolean toggle, serialized as `1`. */
  | { kind: 'flag' };

export type ParamSpec = Record<string, ParamDef>;

export type ParamValues<S extends ParamSpec> = {
  [K in keyof S]: S[K] extends { kind: 'flag' } ? boolean : string;
} & { page: number };

type Reader = { get(key: string): string | null };

const MAX_TEXT = 50;

function fallbackOf(def: ParamDef): string | boolean {
  if (def.kind === 'flag') return false;
  if (def.kind === 'enum') return def.fallback ?? '';
  return '';
}

/** Reads + validates the list params from a query string; unknown / invalid values fall back. */
export function parseListParams<S extends ParamSpec>(sp: Reader, spec: S): ParamValues<S> {
  const out: Record<string, string | boolean | number> = {};
  for (const [key, def] of Object.entries(spec)) {
    const raw = sp.get(key);
    if (def.kind === 'flag') out[key] = raw === '1' || raw === 'true';
    else if (def.kind === 'enum')
      out[key] = raw !== null && def.values.includes(raw) ? raw : (def.fallback ?? '');
    else out[key] = (raw ?? '').trim().slice(0, MAX_TEXT);
  }
  const page = Number(sp.get('page'));
  out.page = Number.isInteger(page) && page > 0 ? page : 1;
  return out as ParamValues<S>;
}

/**
 * Serializes list params to a query string ("" or "?a=b"). Default values are dropped so the
 * canonical URL of an unfiltered list has no query. Keys keep the order of `spec`, `page` last.
 */
export function serializeListParams<S extends ParamSpec>(values: ParamValues<S>, spec: S): string {
  const sp = new URLSearchParams();
  for (const [key, def] of Object.entries(spec)) {
    const value = (values as Record<string, string | boolean | number>)[key];
    if (value === undefined || value === fallbackOf(def)) continue;
    if (def.kind === 'flag') {
      if (value === true) sp.set(key, '1');
    } else if (typeof value === 'string' && value.trim() !== '') {
      sp.set(key, value.trim());
    }
  }
  if (values.page > 1) sp.set('page', String(values.page));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Applies a patch; changing anything but `page` returns to page 1. */
export function patchListParams<S extends ParamSpec>(
  current: ParamValues<S>,
  patch: Partial<ParamValues<S>>,
): ParamValues<S> {
  const next = { ...current, ...patch };
  const touchesFilter = Object.keys(patch).some(
    (k) =>
      k !== 'page' &&
      (patch as Record<string, unknown>)[k] !== (current as Record<string, unknown>)[k],
  );
  return touchesFilter && patch.page === undefined ? { ...next, page: 1 } : next;
}

/** True when any filter differs from its default (page is ignored) — drives "필터 초기화". */
export function hasActiveFilters<S extends ParamSpec>(
  values: ParamValues<S>,
  spec: S,
  ignore: readonly (keyof S)[] = [],
): boolean {
  return Object.entries(spec).some(
    ([key, def]) =>
      !ignore.includes(key) &&
      (values as Record<string, string | boolean | number>)[key] !== fallbackOf(def),
  );
}

/** "19건 중 1–10" range of the current page. */
export function pageRange(page: number, pageSize: number, total: number): [number, number] {
  if (total <= 0) return [0, 0];
  const from = (page - 1) * pageSize + 1;
  return [Math.min(from, total), Math.min(page * pageSize, total)];
}
