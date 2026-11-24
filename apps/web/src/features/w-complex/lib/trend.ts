import { kstParts } from '@/lib/format';
import type { ComplexAreaType, TradeRecord, TradeStat } from '../api/schemas';

/** Current calendar month in Asia/Seoul as YYYYMM (202611). Windows such as "최근 1년" end here. */
export function currentYm(now: Date = new Date()): number {
  const p = kstParts(now);
  return p ? Number(p.year) * 100 + Number(p.month) : now.getFullYear() * 100 + now.getMonth() + 1;
}

/** Adds `delta` months to a YYYYMM number: ymAdd(202601, -2) → 202511. */
export function ymAdd(ym: number, delta: number): number {
  const total = Math.floor(ym / 100) * 12 + ((ym % 100) - 1) + delta;
  return Math.floor(total / 12) * 100 + (total % 12) + 1;
}

/** 202511 → "25.11" */
export function ymLabel(ym: number): string {
  return `${String(Math.floor(ym / 100) % 100).padStart(2, '0')}.${String(ym % 100).padStart(2, '0')}`;
}

/** "2026-10-14" → "26.10" (trade month); returns "" for malformed input. */
export function dealMonthLabel(dealDate: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(dealDate);
  return m ? `${m[1]!.slice(2)}.${m[2]}` : '';
}

/** "2026-10-14" → "26.10.14" */
export function dealDateLabel(dealDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dealDate);
  return m ? `${m[1]!.slice(2)}.${m[2]}.${m[3]}` : dealDate;
}

export type TrendPeriod = '1y' | '3y' | '5y' | 'all';
export const TREND_PERIODS: readonly {
  value: TrendPeriod;
  label: string;
  months: number | null;
}[] = [
  { value: '1y', label: '1년', months: 12 },
  { value: '3y', label: '3년', months: 36 },
  { value: '5y', label: '5년', months: 60 },
  { value: 'all', label: '전체', months: null },
];

/**
 * Months of the window that ends at `end` (the current Seoul month) and spans `months` calendar
 * months (null = everything up to `end`), oldest first. Months without trades are absent; a complex
 * whose last trade is older than the window therefore gets an empty window, not a stale one.
 */
export function trendWindow(
  stats: readonly TradeStat[],
  months: number | null,
  end: number = currentYm(),
): TradeStat[] {
  const from = months === null ? 0 : ymAdd(end, -(months - 1));
  return [...stats]
    .filter((s) => s.yearMonth >= from && s.yearMonth <= end)
    .sort((a, b) => a.yearMonth - b.yearMonth);
}

export interface TrendSummary {
  /** Median prices of the months with trades in the window, oldest first (만원). */
  values: number[];
  /** "25.11" style labels matching `values`. */
  labels: string[];
  startLabel: string;
  endLabel: string;
  /** Newest median minus the oldest median of the window (만원); null with fewer than 2 points. */
  delta: number | null;
  tradeCount: number;
  /** Newest month with trades in the whole series, inside the window or not ("24.03"); null without data. */
  lastTradeLabel: string | null;
}

export function summarizeTrend(
  stats: readonly TradeStat[],
  months: number | null,
  end: number = currentYm(),
): TrendSummary {
  const window = trendWindow(stats, months, end);
  const values = window.map((s) => s.medianPrice);
  const labels = window.map((s) => ymLabel(s.yearMonth));
  const first = values[0];
  const last = values[values.length - 1];
  const newest = stats.reduce<number | null>(
    (max, s) => (s.yearMonth <= end && (max === null || s.yearMonth > max) ? s.yearMonth : max),
    null,
  );
  return {
    values,
    labels,
    startLabel: labels[0] ?? '',
    endLabel: labels[labels.length - 1] ?? '',
    delta: values.length >= 2 && first !== undefined && last !== undefined ? last - first : null,
    tradeCount: window.reduce((sum, s) => sum + s.tradeCount, 0),
    lastTradeLabel: newest === null ? null : ymLabel(newest),
  };
}

/** Months per chart point: monthly, quarterly, half-yearly or yearly. */
export type TrendBucket = 1 | 3 | 6 | 12;
const BUCKETS: readonly TrendBucket[] = [1, 3, 6, 12];
export const BUCKET_LABEL: Record<TrendBucket, string> = {
  1: '월별',
  3: '분기별',
  6: '반기별',
  12: '연도별',
};

export interface TrendSeries {
  /** One label per calendar slot of the window: "25.11" · "25년 4분기" · "25년 하반기" · "2025년". */
  labels: string[];
  /** Median per slot (만원); null where nothing was traded, so the chart shows a gap. */
  values: (number | null)[];
  bucket: TrendBucket;
  /** Calendar span of the window: "23.12 ~ 26.11" ("" without data). */
  rangeLabel: string;
  /** True when at least one slot has a value. */
  hasData: boolean;
}

const monthIndex = (ym: number) => Math.floor(ym / 100) * 12 + (ym % 100) - 1;

function slotLabel(index: number, bucket: TrendBucket): string {
  const year = Math.floor((index * bucket) / 12);
  const month = ((index * bucket) % 12) + 1;
  const yy = String(year % 100).padStart(2, '0');
  if (bucket === 1) return `${yy}.${String(month).padStart(2, '0')}`;
  if (bucket === 3) return `${yy}년 ${Math.ceil(month / 3)}분기`;
  if (bucket === 6) return `${yy}년 ${month <= 6 ? '상' : '하'}반기`;
  return `${year}년`;
}

/** Median of the monthly medians weighted by their trade counts (the slot median for one month). */
function weightedMedian(rows: readonly TradeStat[]): number | null {
  const sorted = [...rows].sort((a, b) => a.medianPrice - b.medianPrice);
  const total = sorted.reduce((sum, r) => sum + Math.max(1, r.tradeCount), 0);
  let seen = 0;
  for (const r of sorted) {
    seen += Math.max(1, r.tradeCount);
    if (seen * 2 >= total) return r.medianPrice;
  }
  return null;
}

/**
 * Chart series of the window on a real calendar axis: one slot per month — or per quarter / half
 * year / year when the window would need more than `maxPoints` slots — with null for slots without
 * trades. The x-axis is therefore proportional to time (a 14-month gap is 14 months wide).
 */
export function trendSeries(
  stats: readonly TradeStat[],
  months: number | null,
  end: number = currentYm(),
  maxPoints = 24,
): TrendSeries {
  const window = trendWindow(stats, months, end);
  const firstYm = months === null ? window[0]?.yearMonth : ymAdd(end, -(months - 1));
  if (firstYm === undefined)
    return { labels: [], values: [], bucket: 1, rangeLabel: '', hasData: false };
  const span = monthIndex(end) - monthIndex(firstYm) + 1;
  const bucket = BUCKETS.find((b) => Math.ceil(span / b) + 1 <= maxPoints) ?? 12;
  // Calendar-aligned slots (quarters start in Jan / Apr / Jul / Oct …).
  const firstSlot = Math.floor(monthIndex(firstYm) / bucket);
  const lastSlot = Math.floor(monthIndex(end) / bucket);
  const labels: string[] = [];
  const values: (number | null)[] = [];
  for (let slot = firstSlot; slot <= lastSlot; slot++) {
    labels.push(slotLabel(slot, bucket));
    values.push(
      weightedMedian(window.filter((s) => Math.floor(monthIndex(s.yearMonth) / bucket) === slot)),
    );
  }
  return {
    labels,
    values,
    bucket,
    rangeLabel: `${ymLabel(firstYm)} ~ ${ymLabel(end)}`,
    hasData: values.some((v) => v !== null),
  };
}

/** Headline amount of a trade: 매매가, or 보증금 for 전세·월세 (만원). */
export function tradeAmount(t: Pick<TradeRecord, 'price' | 'deposit'>): number | null {
  return t.price ?? t.deposit;
}

export interface AreaLatestTrade {
  areaType: ComplexAreaType;
  trade: TradeRecord | null;
}

/** Latest trade of the given deal type for every 평형, in 평형 order (smallest first). */
export function latestByAreaType(
  areaTypes: readonly ComplexAreaType[],
  latest: readonly TradeRecord[],
  dealType: TradeRecord['dealType'] = 'SALE',
): AreaLatestTrade[] {
  return [...areaTypes]
    .sort((a, b) => a.exclusiveArea - b.exclusiveArea)
    .map((areaType) => ({
      areaType,
      trade:
        latest
          .filter((t) => t.dealType === dealType && !t.cancelled && t.areaTypeId === areaType.id)
          .sort((a, b) => (a.dealDate < b.dealDate ? 1 : -1))[0] ?? null,
    }));
}

/** The 평형 shown first: the one with the most households (falls back to the first). */
export function defaultAreaType(areaTypes: readonly ComplexAreaType[]): ComplexAreaType | null {
  return [...areaTypes].sort((a, b) => (b.households ?? 0) - (a.households ?? 0))[0] ?? null;
}
