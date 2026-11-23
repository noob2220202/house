/** Korea has no DST, so KST is a fixed UTC+9 offset. */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** YYYYMM integer between 2000-01 and 2100-12. */
export function isValidYearMonth(value: number): boolean {
  if (!Number.isInteger(value) || value < 200001 || value > 210012) return false;
  const month = value % 100;
  return month >= 1 && month <= 12;
}

/** The KST year-month (YYYYMM) of an instant. */
export function yearMonthOf(date: Date): number {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return kst.getUTCFullYear() * 100 + (kst.getUTCMonth() + 1);
}

/** The KST calendar day of an instant as "YYYYMMDD". */
export function kstDayKey(date: Date): string {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function addMonths(ym: number, delta: number): number {
  const index = Math.floor(ym / 100) * 12 + ((ym % 100) - 1) + delta;
  return Math.floor(index / 12) * 100 + ((index % 12) + 1);
}

/** Inclusive list of months from `from` to `to` (empty when from > to). */
export function yearMonthRange(from: number, to: number): number[] {
  const out: number[] = [];
  for (let ym = from; ym <= to && out.length < 1200; ym = addMonths(ym, 1)) out.push(ym);
  return out;
}

/** 202410 → "2024-10" */
export function formatYearMonth(ym: number): string {
  return `${Math.floor(ym / 100)}-${String(ym % 100).padStart(2, '0')}`;
}
