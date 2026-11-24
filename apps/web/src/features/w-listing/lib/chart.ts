import type { ComplexStats, ComplexTrade } from '../api/schemas';

/** Pure geometry + summary helpers for the 단지 시세 · 실거래가 chart (unit tested). */

export interface ChartPoint {
  /** 0–100 (% of the plot width / height, y measured from the top). */
  x: number;
  y: number;
  value: number;
}

export interface TradeDot extends ChartPoint {
  dealDate: string;
  floor: number | null;
}

export interface PriceChartModel {
  /** Month keys (YYYYMM) of the x domain, oldest first. */
  months: number[];
  ticks: { value: number; y: number }[];
  xLabels: { label: string; x: number }[];
  line: ChartPoint[];
  dots: TradeDot[];
  /** y of the asking-price line, or null when it is outside the domain / not applicable. */
  askY: number | null;
  min: number;
  max: number;
}

export const ymToIndex = (ym: number) => Math.floor(ym / 100) * 12 + (ym % 100) - 1;
export const indexToYm = (index: number) => Math.floor(index / 12) * 100 + (index % 12) + 1;
/** 202401 → "24.01" */
export const formatYm = (ym: number) =>
  `${String(Math.floor(ym / 100)).slice(2)}.${String(ym % 100).padStart(2, '0')}`;

/** Every month between two YYYYMM values, inclusive. */
export function monthRange(fromYm: number, toYm: number): number[] {
  const out: number[] = [];
  for (let i = ymToIndex(fromYm); i <= ymToIndex(toYm); i += 1) out.push(indexToYm(i));
  return out;
}

/** "Nice" tick step (만원) so the axis shows about `count` labels: 1천, 2천, 5천, 1억 … (one-decimal 억 labels stay exact). */
export function niceStep(span: number, count = 5): number {
  if (!(span > 0)) return 1000;
  const rough = span / count;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const unit = rough / pow;
  const nice = unit < 1.5 ? 1 : unit < 3.5 ? 2 : unit < 7.5 ? 5 : 10;
  return Math.max(1000, nice * pow);
}

/** Trade amount used on the chart: 매매 거래금액, 전세·월세 보증금. */
export const tradeAmount = (t: Pick<ComplexTrade, 'price' | 'deposit'>): number | null =>
  t.price ?? t.deposit ?? null;

export function buildPriceChart(
  stats: ComplexStats['months'],
  trades: readonly ComplexTrade[],
  ask: number | null,
): PriceChartModel | null {
  const months = [...stats].sort((a, b) => a.yearMonth - b.yearMonth);
  const first = months[0];
  const last = months[months.length - 1];
  if (!first || !last) return null;
  const domain = monthRange(first.yearMonth, last.yearMonth);
  const startIdx = ymToIndex(first.yearMonth);
  const span = Math.max(1, domain.length - 1);

  const valid = trades
    .filter((t) => !t.cancelled)
    .map((t) => ({
      t,
      amount: tradeAmount(t),
      ym: Number(t.dealDate.slice(0, 7).replace('-', '')),
    }))
    .filter(
      (x): x is { t: ComplexTrade; amount: number; ym: number } =>
        x.amount !== null && x.ym >= first.yearMonth && x.ym <= last.yearMonth,
    );

  const values = [...months.map((m) => m.medianPrice), ...valid.map((v) => v.amount)];
  if (ask !== null) values.push(ask);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const step = niceStep(hi - lo || hi * 0.1);
  const min = Math.floor((lo - step * 0.25) / step) * step;
  const max = Math.ceil((hi + step * 0.25) / step) * step;
  const yOf = (v: number) => ((max - v) / (max - min)) * 100;
  const xOfMonth = (ym: number, day = 15) =>
    ((ymToIndex(ym) - startIdx + (day - 15) / 30) / span) * 100;

  const ticks: PriceChartModel['ticks'] = [];
  for (let v = max; v >= min - 1e-6; v -= step) ticks.push({ value: Math.round(v), y: yOf(v) });

  const labelEvery = domain.length > 30 ? 6 : domain.length > 14 ? 3 : domain.length > 7 ? 2 : 1;
  const xLabels = domain
    .map((ym, i) => ({ label: formatYm(ym), x: (i / span) * 100, i }))
    .filter((l) => l.i % labelEvery === 0)
    .map(({ label, x }) => ({ label, x }));

  return {
    months: domain,
    ticks,
    xLabels,
    line: months.map((m) => ({
      x: xOfMonth(m.yearMonth),
      y: yOf(m.medianPrice),
      value: m.medianPrice,
    })),
    dots: valid
      .map(({ t, amount, ym }) => ({
        x: Math.min(100, Math.max(0, xOfMonth(ym, Number(t.dealDate.slice(8, 10)) || 15))),
        y: yOf(amount),
        value: amount,
        dealDate: t.dealDate,
        floor: t.floor ?? null,
      }))
      .sort((a, b) => a.dealDate.localeCompare(b.dealDate)),
    askY: ask !== null ? yOf(ask) : null,
    min,
    max,
  };
}

/** Smooth-ish SVG path through the points in a 0..100 viewBox (monotone midpoint curve). */
export function linePath(points: readonly ChartPoint[]): string {
  const first = points[0];
  if (!first) return '';
  let d = `M${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const midX = (prev.x + cur.x) / 2;
    d += ` C${midX.toFixed(2)} ${prev.y.toFixed(2)} ${midX.toFixed(2)} ${cur.y.toFixed(2)} ${cur.x.toFixed(2)} ${cur.y.toFixed(2)}`;
  }
  return d;
}

export interface PriceSummary {
  /** Latest monthly median (만원) and its month. */
  latestMedian: number;
  latestYm: number;
  /** Median twelve months earlier (closest month at or before). */
  yearAgoMedian: number | null;
  yearAgoYm: number | null;
  /** Relative change vs a year ago (0.048 → +4.8%). */
  changeRatio: number | null;
  /** Trades in the last 12 months of the series. */
  tradeCount12m: number;
}

export function summarizeStats(stats: ComplexStats['months']): PriceSummary | null {
  const months = [...stats].sort((a, b) => a.yearMonth - b.yearMonth);
  const last = months[months.length - 1];
  if (!last) return null;
  const lastIdx = ymToIndex(last.yearMonth);
  const yearAgo = [...months].reverse().find((m) => ymToIndex(m.yearMonth) <= lastIdx - 12);
  const tradeCount12m = months
    .filter((m) => ymToIndex(m.yearMonth) > lastIdx - 12)
    .reduce((sum, m) => sum + m.tradeCount, 0);
  return {
    latestMedian: last.medianPrice,
    latestYm: last.yearMonth,
    yearAgoMedian: yearAgo?.medianPrice ?? null,
    yearAgoYm: yearAgo?.yearMonth ?? null,
    changeRatio:
      yearAgo && yearAgo.medianPrice > 0
        ? (last.medianPrice - yearAgo.medianPrice) / yearAgo.medianPrice
        : null,
    tradeCount12m,
  };
}
