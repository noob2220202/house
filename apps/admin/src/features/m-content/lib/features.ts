import { SUBSCRIPTION_REQUIRED_FEATURE } from '@house/shared';
import { FEATURE_META } from './labels';

const PAID_FLAGS: readonly string[] = Object.values(SUBSCRIPTION_REQUIRED_FEATURE);

/**
 * 기능 설정 switches in two groups: `visibility` — turning one off hides that menu / area of the
 * user site (any unknown backend flag goes here) — and `paid` — the 유료 적용 switches, which work
 * the other way round (on = only offices with a recorded 이용 기간 may use the product).
 */
export function groupFlags(keys: readonly string[]): { visibility: string[]; paid: string[] } {
  return {
    visibility: keys.filter((k) => !PAID_FLAGS.includes(k)),
    paid: keys.filter((k) => PAID_FLAGS.includes(k)),
  };
}

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
