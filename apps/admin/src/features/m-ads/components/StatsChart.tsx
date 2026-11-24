'use client';
import { LineChart } from '@house/ui';
import { useEffect, useRef, useState } from 'react';
import { formatCount, formatPercent } from '@/lib/format';
import { formatDayShort } from '../lib/dates';
import { lastLabelCollides, METRIC_NAME, type DailyRow, type Metric } from '../lib/stats';
import styles from './stats.module.css';

export interface StatsChartProps {
  rows: readonly DailyRow[];
  metric: Metric;
  /** Banner title for the accessible chart label. */
  title: string;
}

const COLOR: Record<Metric, string> = {
  impressions: 'var(--brand)',
  clicks: 'var(--success)',
  ctr: 'var(--accent-text)',
};

/** Daily line of one metric (code-split: loaded with next/dynamic by the stats screen). */
export default function StatsChart({ rows, metric, title }: StatsChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={styles.chart}
      // The shared chart always prints the last date; drop the one before it when they would overlap.
      data-drop-penultimate={lastLabelCollides(rows.length, width) ? '' : undefined}
    >
      <LineChart
        label={`${title} 일별 ${METRIC_NAME[metric]}`}
        labels={rows.map((r) => formatDayShort(r.date))}
        series={[
          {
            name: METRIC_NAME[metric],
            values: rows.map((r) =>
              metric === 'ctr' ? Math.round(r.ctr * 10000) / 100 : r[metric],
            ),
            color: COLOR[metric],
            area: true,
          },
        ]}
        height={260}
        zeroBased
        legend={false}
        formatY={(v) => (metric === 'ctr' ? formatPercent(v / 100) : formatCount(v))}
      />
    </div>
  );
}
