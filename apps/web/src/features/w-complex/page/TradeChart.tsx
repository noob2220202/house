'use client';
import { LineChart } from '@house/ui';
import { formatPriceAxis } from '@/lib/format';

/** Axis label ("4.25억", "9,500만") — the shared `formatPriceAxis` (same as the listing page). */
export const chartPriceLabel = (manwon: number) => formatPriceAxis(manwon);

export interface TradeChartProps {
  label: string;
  seriesName: string;
  labels: readonly string[];
  values: readonly (number | null)[];
}

/**
 * 실거래가 line chart (median per month / quarter …) on a calendar axis — null slots are gaps.
 * The area fill is only drawn without inner gaps (the shared chart closes the area once per series);
 * leading / trailing empty slots (e.g. the current month, not reported yet) do not count.
 * Loaded on demand — see TradeSection.
 */
export default function TradeChart({ label, seriesName, labels, values }: TradeChartProps) {
  const first = values.findIndex((v) => v !== null);
  const last = values.findLastIndex((v) => v !== null);
  const gapless = first >= 0 && values.slice(first, last + 1).every((v) => v !== null);
  return (
    <LineChart
      label={label}
      labels={labels}
      height={240}
      legend={false}
      series={[{ name: seriesName, values, area: gapless }]}
      formatY={chartPriceLabel}
    />
  );
}
