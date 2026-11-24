/** Deterministic UUID (v4-shaped) from a seed — same function as apps/web/src/lib/mock so ids line up. */
export function mockUuid(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  const hex = h.toString(16).padStart(8, '0');
  return `${hex}-0000-4000-8000-${hex}${hex.slice(0, 4)}`;
}

/** Same ids as the user-site mocks (agencies / complexes), so cross-app links work in mock mode. */
export const agencyIdOf = (key: string) => mockUuid(`agency-${key}`);
export const complexIdOf = (code: string) => mockUuid(code);

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3_600_000;

/** Calendar day in KST, `offset` days from today: "2026-11-24". */
export function kstDay(offset = 0, now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS + offset * DAY_MS).toISOString().slice(0, 10);
}
export const startOfKstDay = (day: string) => `${day}T00:00:00+09:00`;
export const endOfKstDay = (day: string) => `${day}T23:59:59+09:00`;

/** Days between two KST calendar days (b − a). */
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}
