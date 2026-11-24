import type { BannerStats } from '../api/schemas';
import { addDays, dayDiff, isDay, kstToday } from './dates';
import { ctrOf } from './status';

export type RangePreset = '7' | '14' | '30' | 'all';
export const RANGE_PRESETS: readonly { value: RangePreset | 'custom'; label: string }[] = [
  { value: '7', label: '7일' },
  { value: '14', label: '14일' },
  { value: '30', label: '30일' },
  { value: 'all', label: '전체 기간' },
  { value: 'custom', label: '직접 선택' },
];
export const DEFAULT_RANGE: RangePreset = '14';

export interface ResolvedRange {
  preset: RangePreset | 'custom';
  /** Inclusive KST days; undefined = whole campaign. */
  from?: string;
  to?: string;
}

/**
 * Stats range from the query string: `?from=&to=` (custom) wins over `?range=7|14|30|all`.
 * Presets end today (KST) and include it: "7일" = today and the six days before.
 */
export function resolveRange(
  query: { range?: string | null; from?: string | null; to?: string | null },
  now: Date = new Date(),
): ResolvedRange {
  const today = kstToday(now);
  const { from, to } = query;
  if (from && to && isDay(from) && isDay(to) && from <= to) return { preset: 'custom', from, to };
  const preset: RangePreset =
    query.range === '7' || query.range === '14' || query.range === '30' || query.range === 'all'
      ? query.range
      : DEFAULT_RANGE;
  if (preset === 'all') return { preset };
  return { preset, from: addDays(today, -(Number(preset) - 1)), to: today };
}

export type Metric = 'impressions' | 'clicks' | 'ctr';
export const METRIC_OPTIONS: readonly { value: Metric; label: string }[] = [
  { value: 'impressions', label: '노출' },
  { value: 'clicks', label: '클릭' },
  { value: 'ctr', label: 'CTR' },
];
export const METRIC_NAME: Record<Metric, string> = {
  impressions: '노출수',
  clicks: '클릭수',
  ctr: '클릭률(CTR)',
};

export interface DailyRow {
  date: string;
  impressions: number;
  clicks: number;
  /** Ratio 0–1. */
  ctr: number;
}

/**
 * Daily rows for the chart / table. When a range is given, days without data inside it are filled
 * with zeros so the x-axis is continuous (the API only returns days that have a stat row).
 */
export function dailyRows(
  stats: Pick<BannerStats, 'daily'>,
  range?: { from?: string; to?: string },
): DailyRow[] {
  const byDate = new Map(stats.daily.map((d) => [d.date, d]));
  const dates = [...byDate.keys()].sort();
  const from = range?.from ?? dates[0];
  const to = range?.to ?? dates[dates.length - 1];
  if (!from || !to || !isDay(from) || !isDay(to) || from > to) return [];
  const length = Math.min(dayDiff(from, to) + 1, 400);
  return Array.from({ length }, (_, i) => {
    const date = addDays(from, i);
    const row = byDate.get(date);
    const impressions = row?.impressions ?? 0;
    const clicks = row?.clicks ?? 0;
    return { date, impressions, clicks, ctr: ctrOf(impressions, clicks) };
  });
}

export interface StatsSummary {
  impressions: number;
  clicks: number;
  ctr: number;
  /**
   * Days the averages are taken over: from the first day with an impression to the end of the
   * range (a range that starts before the campaign must not water the daily average down).
   */
  activeDays: number;
  avgImpressions: number;
  avgClicks: number;
  /** Day with the most impressions, or null when there is no data. */
  best: DailyRow | null;
}

export function summarize(rows: readonly DailyRow[]): StatsSummary {
  const impressions = rows.reduce((sum, r) => sum + r.impressions, 0);
  const clicks = rows.reduce((sum, r) => sum + r.clicks, 0);
  const best = rows.reduce<DailyRow | null>(
    (top, r) => (r.impressions > (top?.impressions ?? 0) ? r : top),
    null,
  );
  const firstActive = rows.findIndex((r) => r.impressions > 0);
  const activeDays = firstActive < 0 ? 0 : rows.length - firstActive;
  return {
    impressions,
    clicks,
    ctr: ctrOf(impressions, clicks),
    activeDays,
    avgImpressions: activeDays > 0 ? Math.round(impressions / activeDays) : 0,
    avgClicks: activeDays > 0 ? Math.round(clicks / activeDays) : 0,
    best,
  };
}

/**
 * True when the last x-axis label of the `@house/ui` LineChart would overlap the label before it.
 * The chart shows every n-th label (one per ~72px) plus always the last one, so the last two collide
 * whenever the series length is not on that grid. Mirrors the chart's geometry (plot inset 44 + 12).
 */
export function lastLabelCollides(count: number, width: number, minGap = 52): boolean {
  if (count < 3 || width <= 0) return false;
  const maxLabels = Math.max(2, Math.floor(width / 72));
  const every = Math.ceil(count / maxLabels);
  const last = count - 1;
  const previous = Math.floor(last / every) * every;
  if (previous === last) return false;
  const step = Math.max(0, width - 56) / last;
  return (last - previous) * step < minGap;
}
