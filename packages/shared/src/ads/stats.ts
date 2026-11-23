/** Korea has no DST, so KST is a fixed UTC+9 offset. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" of `now` in Asia/Seoul (the day ad counters are bucketed by). */
export function kstDate(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" shifted by `days`. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Inclusive list of "YYYY-MM-DD" dates from `from` to `to` (empty when from > to). */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Inclusive day count between two "YYYY-MM-DD" dates. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

/** Click-through rate in percent with two decimals (0 when there were no impressions). */
export function ctrPercent(clicks: number, impressions: number): number {
  if (impressions <= 0) return 0;
  return Math.round((clicks / impressions) * 10_000) / 100;
}
