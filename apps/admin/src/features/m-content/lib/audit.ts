/** 작업 기록 filter helpers (pure; unit tested). Dates are KST calendar dates "YYYY-MM-DD". */
import { addDaysKst } from '@/lib/format';

export type RangePreset = 'all' | 'today' | '7d' | '30d' | 'custom';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `date` shifted by `days` calendar days. */
export const shiftDate = (date: string, days: number): string => addDaysKst(date, days);

/**
 * Date inputs → the `from` / `to` datetimes of auditLogQuerySchema: start of the first day and end
 * of the last day in KST. Invalid or empty inputs are left out.
 */
export function auditRange(from: string, to: string): { from?: string; to?: string } {
  return {
    from: DATE_RE.test(from) ? `${from}T00:00:00+09:00` : undefined,
    to: DATE_RE.test(to) ? `${to}T23:59:59.999+09:00` : undefined,
  };
}

/** Which quick range the current inputs correspond to (for the segmented control). */
export function rangePresetOf(from: string, to: string, today: string): RangePreset {
  if (!from && !to) return 'all';
  if (to !== today) return 'custom';
  if (from === today) return 'today';
  if (from === shiftDate(today, -6)) return '7d';
  if (from === shiftDate(today, -29)) return '30d';
  return 'custom';
}
