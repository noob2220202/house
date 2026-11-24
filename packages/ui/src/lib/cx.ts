export type ClassValue = string | false | null | undefined | 0;

/** Tiny classnames helper. */
export function cx(...values: ClassValue[]): string {
  let out = '';
  for (const v of values) {
    if (v) out += out ? ` ${v}` : v;
  }
  return out;
}
