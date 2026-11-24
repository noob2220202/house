'use client';
import {
  Button,
  Delta,
  EmptyState,
  Icon,
  Panel,
  SegmentedControl,
  Skeleton,
  StatTile,
  Table,
  cx,
  type IconName,
  type TableColumn,
} from '@house/ui';
import dynamic from 'next/dynamic';
import { useState, type ReactNode } from 'react';
import { formatCount } from '@/lib/format';
import { LoadError } from '../components/LoadError';
import { chartData, deltaOf, toCsv, weekdayLabel, weekdayOf } from '../lib/stats';
import styles from './stats.module.css';

// The chart is client-only (it measures its container) and split out of the page bundle.
const TrendChart = dynamic(() => import('./TrendChart').then((m) => m.TrendChart), {
  ssr: false,
  loading: () => <Skeleton height={248} radius={12} />,
});

export type Days = 7 | 30 | 90;

/** KPI tile with a delta against the period right before the selected one. */
export function Kpi({
  label,
  value,
  unit,
  current,
  previous,
  days,
  icon,
  note,
  brand,
}: {
  label: string;
  /** Formatted figure. */
  value: string;
  unit?: string;
  /** Raw numbers for the delta; leave both out for a point-in-time figure. */
  current?: number;
  previous?: number;
  days: Days;
  icon: IconName;
  /** Detail line when there is no delta. */
  note?: ReactNode;
  brand?: boolean;
}) {
  const delta = current !== undefined && previous !== undefined ? deltaOf(current, previous) : null;
  return (
    <StatTile
      label={label}
      value={value}
      unit={unit}
      icon={<Icon name={icon} size={18} />}
      iconTone={brand ? 'brand' : 'neutral'}
      detail={
        delta ? (
          <>
            <Delta direction={delta.direction} good={delta.direction === 'up'}>
              {delta.label}
            </Delta>
            <span className={styles.vs}>이전 {days}일 대비</span>
          </>
        ) : (
          (note ?? <span className={styles.vs}>비교할 이전 기간 자료가 없어요</span>)
        )
      }
    />
  );
}

export function KpiSkeleton() {
  return (
    <div className={styles.kpis} aria-busy="true">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} height={104} radius={16} />
      ))}
    </div>
  );
}

export interface Metric<T> {
  key: string;
  label: string;
  unit: string;
  /** Reduces the rows of one chart point (or of the whole period for the headline). */
  value: (rows: readonly T[]) => number;
  format?: (value: number) => string;
}

/** One metric at a time on a single axis; the segmented control switches the metric. */
export function TrendPanel<T extends { date: string }>({
  title,
  points,
  metrics,
  days,
}: {
  title: string;
  points: readonly T[];
  metrics: readonly [Metric<T>, ...Metric<T>[]];
  days: Days;
}) {
  const [key, setKey] = useState(metrics[0].key);
  const metric = metrics.find((m) => m.key === key) ?? metrics[0];
  const format = metric.format ?? formatCount;
  const data = chartData(points, metric.value);
  return (
    <Panel
      title={title}
      description={data.weekly ? `7일 단위 합계 · 최근 ${data.days / 7}주` : '하루 단위'}
      actions={
        metrics.length > 1 ? (
          <SegmentedControl
            label="지표"
            size="sm"
            value={metric.key}
            onChange={setKey}
            options={metrics.map((m) => ({ value: m.key, label: m.label }))}
          />
        ) : undefined
      }
    >
      {points.length === 0 ? (
        <EmptyState
          compact
          icon="chart"
          title="이 기간에 집계된 자료가 없어요"
          description="자료는 매일 새벽에 전날 치가 집계돼요."
        />
      ) : (
        <>
          <p className={styles.chartHead}>
            <span className={styles.chartTotal}>
              {format(metric.value(points))}
              {metric.unit}
            </span>
            <span className={styles.chartTotalLabel}>
              최근 {days}일 {metric.label}
            </span>
          </p>
          <TrendChart
            label={`${title} — ${metric.label}`}
            name={metric.label}
            labels={data.labels}
            titles={data.titles}
            values={data.values}
            format={format}
            unit={metric.unit}
          />
        </>
      )}
    </Panel>
  );
}

export interface DailyColumn<T> {
  header: string;
  /** Raw value for the CSV. */
  value: (row: T) => number;
  format?: (value: number) => string;
}

function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** The numbers behind the chart as a table (newest first) with a CSV download. */
export function DailyTable<T extends { date: string }>({
  name,
  points,
  columns,
}: {
  /** Used in the caption and the file name, e.g. "방문·가입". */
  name: string;
  points: readonly T[];
  columns: readonly DailyColumn<T>[];
}) {
  const rows = [...points].reverse();
  const tableColumns: TableColumn<T>[] = [
    {
      key: 'date',
      header: '날짜',
      cell: (row) => {
        const dow = weekdayOf(row.date);
        return (
          <span className={cx(styles.dateCell, (dow === 0 || dow === 6) && styles.weekend)}>
            {row.date.replaceAll('-', '.')} ({weekdayLabel(row.date)})
          </span>
        );
      },
    },
    ...columns.map((c, i) => ({
      key: `c${i}`,
      header: c.header,
      align: 'right' as const,
      cell: (row: T) => (
        <span className={styles.barValue}>{(c.format ?? formatCount)(c.value(row))}</span>
      ),
    })),
  ];
  return (
    <Panel
      title="일별 수치"
      count={points.length > 0 ? `${points.length}일` : undefined}
      flush
      actions={
        <Button
          size="sm"
          variant="secondary"
          iconLeft={<Icon name="download" size={16} />}
          disabled={points.length === 0}
          onClick={() =>
            downloadCsv(
              `통계-${name}-${points[points.length - 1]?.date ?? ''}-${points.length}일.csv`,
              toCsv(
                ['날짜', ...columns.map((c) => c.header)],
                points.map((p) => [p.date, ...columns.map((c) => c.value(p))]),
              ),
            )
          }
        >
          CSV 내려받기
        </Button>
      }
    >
      <Table
        bare
        density="compact"
        stickyHeader
        maxHeight={344}
        caption={`${name} 일별 수치`}
        columns={tableColumns}
        rows={rows}
        rowKey={(row) => row.date}
        empty={<EmptyState compact icon="chart" title="이 기간에 집계된 자료가 없어요" />}
      />
    </Panel>
  );
}

/** Loading / error frame shared by the four sections. */
export function SectionState({
  isPending,
  error,
  onRetry,
}: {
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  if (isPending)
    return (
      <>
        <KpiSkeleton />
        <div className={styles.row} aria-busy="true">
          <Skeleton height={360} radius={16} />
          <Skeleton height={360} radius={16} />
        </div>
      </>
    );
  return (
    <Panel>
      <LoadError error={error} onRetry={onRetry} title="통계를 불러오지 못했어요" />
    </Panel>
  );
}
