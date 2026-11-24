import { addDaysKst, toKstDateString, type DateInput } from '@/lib/format';

const DAY_MS = 86_400_000;

/** KST calendar day of a moment: "2026-11-24". */
export const toKstDay = (input: DateInput): string => toKstDateString(input);

/** Today's KST calendar day. */
export const kstToday = (now: Date = new Date()): string => toKstDateString(now);

/** First / last instant of a KST calendar day as an ISO datetime with offset (dateTimeSchema). */
export const startOfKstDay = (day: string) => `${day}T00:00:00+09:00`;
export const endOfKstDay = (day: string) => `${day}T23:59:59+09:00`;

export const isDay = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** Calendar day `n` days after `day` (shared KST helper). */
export const addDays = addDaysKst;

/** Whole days from `a` to `b` (b − a) between two calendar days. */
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** "11.01" */
export function formatDayShort(day: string): string {
  return isDay(day) ? `${day.slice(5, 7)}.${day.slice(8, 10)}` : '';
}

/** "2026.11.01" */
export function formatDayFull(day: string): string {
  return isDay(day) ? day.replace(/-/g, '.') : '';
}

/** Period for list rows: "11.01 – 11.30"; the years are shown when they differ ("25.12.20 – 26.01.19"). */
export function formatPeriodShort(startAt: DateInput, endAt: DateInput): string {
  const a = toKstDay(startAt);
  const b = toKstDay(endAt);
  if (!a || !b) return '';
  if (a.slice(0, 4) === b.slice(0, 4)) return `${formatDayShort(a)} – ${formatDayShort(b)}`;
  return `${a.slice(2).replace(/-/g, '.')} – ${b.slice(2).replace(/-/g, '.')}`;
}
