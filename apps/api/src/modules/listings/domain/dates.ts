const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** "YYYY-MM-DD" → Date at UTC midnight (for @db.Date columns). */
export function dateOnlyToDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** @db.Date column → "YYYY-MM-DD". */
export function dateToDateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/** "YYYY-MM-DD" (a KST calendar day) → the instant of that day's KST midnight. */
export function kstDayStart(value: string): Date {
  return new Date(new Date(`${value}T00:00:00.000Z`).getTime() - KST_OFFSET_MS);
}

/** Today's date in Asia/Seoul as "YYYY-MM-DD". */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
