import { FEATURE_META } from './labels';

/** Known flags first (in the order of FEATURE_META), then any extra key the backend stores. */
export function orderedFlags(value: Record<string, boolean>): string[] {
  const known = Object.keys(FEATURE_META);
  const extra = Object.keys(value)
    .filter((k) => !known.includes(k))
    .sort();
  return [...known, ...extra];
}

/** Stored value → a complete flag map: missing known flags are off. */
export function normalizeFlags(
  value: Record<string, boolean> | null | undefined,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of orderedFlags(value ?? {})) out[key] = value?.[key] ?? false;
  return out;
}
