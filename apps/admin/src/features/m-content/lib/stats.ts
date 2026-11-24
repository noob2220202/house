/** Small numeric helpers for the 통계 screen (pure; unit tested). */

export const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

/** Percentage change from `previous` to `current`; null when there is no baseline. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** `part / whole` as a 0–1 ratio (0 when the denominator is 0). */
export const ratio = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole);

export interface DeltaInfo {
  direction: 'up' | 'down' | 'flat';
  /** "8.6%" — absolute value, one decimal. */
  label: string;
}

/** Delta chip content for a KPI; null when there is no baseline to compare with. */
export function deltaOf(current: number, previous: number): DeltaInfo | null {
  const pct = pctChange(current, previous);
  if (pct === null) return null;
  const rounded = Math.round(Math.abs(pct) * 10) / 10;
  return {
    direction: rounded === 0 ? 'flat' : pct > 0 ? 'up' : 'down',
    label: `${rounded.toFixed(1)}%`,
  };
}

export interface Bucket<T> {
  /** First and last date of the bucket (YYYY-MM-DD). */
  from: string;
  to: string;
  rows: T[];
}

/**
 * Groups daily rows into consecutive buckets of `size` days, aligned to the END of the series so the
 * newest bucket is always full (the oldest one may be shorter).
 */
export function bucketDays<T extends { date: string }>(
  rows: readonly T[],
  size: number,
): Bucket<T>[] {
  if (size <= 1) return rows.map((r) => ({ from: r.date, to: r.date, rows: [r] }));
  const buckets: Bucket<T>[] = [];
  for (let end = rows.length; end > 0; end -= size) {
    const chunk = rows.slice(Math.max(0, end - size), end);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    if (first && last) buckets.unshift({ from: first.date, to: last.date, rows: chunk });
  }
  return buckets;
}

/** "2026-11-17" → "11.17" */
export const shortDate = (date: string): string =>
  `${Number(date.slice(5, 7))}.${date.slice(8, 10)}`;

/** Keeps roughly `max` evenly spaced axis labels (the last one always stays). */
export function sparseLabels(labels: readonly string[], max = 8): string[] {
  if (labels.length <= max) return [...labels];
  const step = Math.ceil(labels.length / max);
  const last = labels.length - 1;
  return labels.map((label, i) => ((last - i) % step === 0 ? label : ''));
}

const BOM = String.fromCharCode(0xfeff);

/** RFC 4180 CSV with a BOM so Excel opens Korean text correctly. */
export function toCsv(
  header: readonly string[],
  rows: readonly (readonly (string | number)[])[],
): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `${BOM}${[header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;
}

export interface ChartData {
  labels: string[];
  /** Tooltip titles: "11.24 (화)" for a day, "11.17 – 11.23" for a 7-day bucket. */
  titles: string[];
  values: number[];
  /** True when the points are 7-day buckets instead of single days. */
  weekly: boolean;
  /** Days covered by the points (shorter than the input when a partial week was dropped). */
  days: number;
}

/**
 * Chart points for one metric: daily up to 31 days, 7-day buckets beyond that (90-day view).
 * `value` reduces the rows of one point — a sum for counts, a recomputed ratio for rates.
 * A partial oldest week (90 = 12 × 7 + 6) is left out: a 6-day sum next to 7-day sums would read
 * as a dip that is not there.
 */
export function chartData<T extends { date: string }>(
  rows: readonly T[],
  value: (rows: readonly T[]) => number,
): ChartData {
  const weekly = rows.length > 31;
  const buckets = bucketDays(rows, weekly ? 7 : 1).filter((b) => !weekly || b.rows.length === 7);
  return {
    weekly,
    days: buckets.reduce((acc, b) => acc + b.rows.length, 0),
    labels: buckets.map((b) => shortDate(weekly ? b.to : b.from)),
    titles: buckets.map((b) =>
      b.from === b.to
        ? `${shortDate(b.from)} (${weekdayLabel(b.from)})`
        : `${shortDate(b.from)} – ${shortDate(b.to)}`,
    ),
    values: buckets.map((b) => value(b.rows)),
  };
}

/** Sum of one numeric field over rows. */
export const total = <T>(rows: readonly T[], pick: (row: T) => number): number =>
  rows.reduce((acc, row) => acc + pick(row), 0);

/** Index of the largest value (first one on ties); -1 for an empty list. */
export function peakIndex(values: readonly number[]): number {
  let best = -1;
  values.forEach((v, i) => {
    if (best === -1 || v > (values[best] ?? -Infinity)) best = i;
  });
  return best;
}

/** "42분" · "1시간 5분" · "2시간" for average response times. */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}분`;
  const rest = m % 60;
  return rest === 0 ? `${Math.floor(m / 60)}시간` : `${Math.floor(m / 60)}시간 ${rest}분`;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;
/** 0 (일) … 6 (토) of a calendar date "YYYY-MM-DD". */
export const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();
export const weekdayLabel = (date: string): string => WEEKDAYS[weekdayOf(date)] ?? '';

/**
 * Indexes of the points that get an x-axis label: evenly spaced, counted back from the newest
 * point (which is always labelled) and at least `minGap` px apart so labels never collide.
 */
export function axisLabelIndexes(count: number, plotWidth: number, minGap = 64): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const max = Math.max(2, Math.floor(plotWidth / minGap) + 1);
  const step = Math.max(1, Math.ceil((count - 1) / (max - 1)));
  const out: number[] = [];
  for (let i = count - 1; i >= 0; i -= step) out.unshift(i);
  return out;
}
