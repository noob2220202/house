'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import styles from './Charts.module.css';
import { cx } from '../lib/cx';

function useElementWidth(fallback: number): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      const w = el.clientWidth;
      if (w > 0) setWidth(w);
    };
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** "Nice" tick values covering [0|min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) {
    if (max === 0) return [0, 1];
    min = Math.min(0, min);
  }
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

export interface SparklineProps {
  values: readonly number[];
  width?: number;
  height?: number;
  /** CSS colour (default brand). */
  color?: string;
  /** Soft area fill under the line. */
  area?: boolean;
  /** Dot on the last value. */
  endDot?: boolean;
  /** Accessible summary, e.g. "최근 12개월 실거래가 추이, 4억 1천에서 4억 4천으로 상승". */
  label: string;
  className?: string;
}

/** Tiny inline trend line (pure SVG, server-renderable shape). */
export function Sparkline({
  values,
  width = 120,
  height = 36,
  color = 'var(--brand)',
  area = true,
  endDot = true,
  label,
  className,
}: SparklineProps) {
  const id = useId();
  if (values.length === 0)
    return (
      <svg width={width} height={height} role="img" aria-label={label} className={className} />
    );
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) =>
    pad +
    (values.length === 1 ? (width - pad * 2) / 2 : (i * (width - pad * 2)) / (values.length - 1));
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const line = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ');
  const last = values.length - 1;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className={cx(styles.spark, className)}
    >
      {area && (
        <>
          <defs>
            <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.18" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${line} L${x(last).toFixed(1)} ${height} L${x(0).toFixed(1)} ${height} Z`}
            fill={`url(#${id}-g)`}
          />
        </>
      )}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {endDot && (
        <circle
          cx={x(last)}
          cy={y(values[last]!)}
          r="3"
          fill={color}
          stroke="var(--surface)"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}

export interface ChartSeries {
  name: string;
  values: readonly (number | null)[];
  /** CSS colour; defaults: brand for the first series, grey for the rest. */
  color?: string;
  dashed?: boolean;
  /** Soft area fill under this series. */
  area?: boolean;
}

interface ChartBaseProps {
  /** X-axis category labels (one per data point). */
  labels: readonly string[];
  height?: number;
  /** Formats y values for ticks, tooltip and the data table. */
  formatY?: (value: number) => string;
  /** Accessible title of the chart. */
  label: string;
  /** Force the y-axis to start at 0 (default true for bars, false for lines). */
  zeroBased?: boolean;
  className?: string;
}

export interface LineChartProps extends ChartBaseProps {
  series: readonly ChartSeries[];
  /** Show the legend above the plot. */
  legend?: boolean;
}

const M = { top: 12, right: 12, bottom: 28, left: 44 };

function DataTable({
  label,
  labels,
  series,
  formatY,
}: {
  label: string;
  labels: readonly string[];
  series: readonly ChartSeries[];
  formatY: (v: number) => string;
}) {
  // The wrapper is the sr-only box: a table cannot shrink below its content width, so putting
  // .sr-only (nowrap) on the table itself would widen narrow pages.
  return (
    <div className="sr-only">
      <table>
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">구분</th>
            {series.map((s) => (
              <th key={s.name} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((l, i) => (
            <tr key={`${l}-${i}`}>
              <th scope="row">{l}</th>
              {series.map((s) => {
                const v = s.values[i];
                return <td key={s.name}>{v === null || v === undefined ? '-' : formatY(v)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useScale(all: number[], height: number, width: number, count: number, zeroBased: boolean) {
  const dataMin = all.length ? Math.min(...all) : 0;
  const dataMax = all.length ? Math.max(...all) : 1;
  const ticks = niceTicks(zeroBased ? Math.min(0, dataMin) : dataMin, dataMax, 3);
  const yMin = ticks[0] ?? 0;
  const yMax = ticks[ticks.length - 1] ?? 1;
  const plotW = Math.max(10, width - M.left - M.right);
  const plotH = Math.max(10, height - M.top - M.bottom);
  const y = (v: number) => M.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;
  const band = plotW / Math.max(1, count);
  return { ticks, y, plotW, plotH, band };
}

function Axes({
  ticks,
  y,
  width,
  formatY,
}: {
  ticks: number[];
  y: (v: number) => number;
  width: number;
  formatY: (v: number) => string;
}) {
  return (
    <g aria-hidden="true">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} className={styles.grid} />
          <text x={M.left - 8} y={y(t)} dy="0.35em" textAnchor="end" className={styles.tick}>
            {formatY(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

function XLabels({
  labels,
  xAt,
  height,
  width,
}: {
  labels: readonly string[];
  xAt: (i: number) => number;
  height: number;
  width: number;
}) {
  const maxLabels = Math.max(2, Math.floor(width / 72));
  const every = Math.ceil(labels.length / maxLabels);
  return (
    <g aria-hidden="true">
      {labels.map((l, i) =>
        i % every === 0 || i === labels.length - 1 ? (
          <text
            key={`${l}-${i}`}
            x={xAt(i)}
            y={height - 8}
            textAnchor="middle"
            className={styles.tick}
          >
            {l}
          </text>
        ) : null,
      )}
    </g>
  );
}

function ChartTip({
  x,
  title,
  rows,
}: {
  x: number;
  title: string;
  rows: { name: string; value: string; color: string }[];
}) {
  return (
    <div className={styles.tip} style={{ left: x }} aria-hidden="true">
      <b>{title}</b>
      {rows.map((r) => (
        <span key={r.name}>
          <i style={{ background: r.color }} />
          {r.name} <strong>{r.value}</strong>
        </span>
      ))}
    </div>
  );
}

const seriesColor = (s: ChartSeries, i: number) =>
  s.color ?? (i === 0 ? 'var(--brand)' : 'var(--grey-400)');

/** Simple responsive SVG line chart with hover/focus readout and a screen-reader data table. */
export function LineChart({
  series,
  labels,
  height = 220,
  formatY = (v) => v.toLocaleString('ko-KR'),
  label,
  zeroBased = false,
  legend = true,
  className,
}: LineChartProps) {
  const [ref, width] = useElementWidth(640);
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const { ticks, y, plotW } = useScale(all, height, width, labels.length, zeroBased);
  const xAt = (i: number) =>
    M.left + (labels.length <= 1 ? plotW / 2 : (i * plotW) / (labels.length - 1));
  const path = (values: readonly (number | null)[]) => {
    let d = '';
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${xAt(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };
  const onMove = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || labels.length === 0) return;
    const rel = (clientX - rect.left - M.left) / (plotW || 1);
    setHover(Math.max(0, Math.min(labels.length - 1, Math.round(rel * (labels.length - 1)))));
  };
  return (
    <figure className={cx(styles.chart, className)}>
      {legend && series.length > 1 && (
        <figcaption className={styles.legend} aria-hidden="true">
          {series.map((s, i) => (
            <span key={s.name}>
              <i
                style={{
                  borderTopColor: seriesColor(s, i),
                  borderTopStyle: s.dashed ? 'dashed' : 'solid',
                }}
              />
              {s.name}
            </span>
          ))}
        </figcaption>
      )}
      <div
        ref={ref}
        className={styles.plot}
        style={{ height }}
        tabIndex={0}
        role="group"
        aria-label={`${label} — 좌우 화살표 키로 값을 탐색할 수 있어요`}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setHover((h) => Math.min(labels.length - 1, (h ?? -1) + 1));
          else if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? labels.length) - 1));
        }}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <Axes ticks={ticks} y={y} width={width} formatY={formatY} />
          <XLabels labels={labels} xAt={xAt} height={height} width={width} />
          {series.map((s, i) => {
            const color = seriesColor(s, i);
            const first = s.values.findIndex((v) => v !== null);
            const lastIdx =
              s.values.length - 1 - [...s.values].reverse().findIndex((v) => v !== null);
            return (
              <g key={s.name}>
                {s.area && first >= 0 && (
                  <path
                    d={`${path(s.values)} L${xAt(lastIdx).toFixed(1)} ${height - M.bottom} L${xAt(first).toFixed(1)} ${height - M.bottom} Z`}
                    fill={color}
                    opacity="0.08"
                  />
                )}
                <path
                  d={path(s.values)}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={s.dashed ? '5 5' : undefined}
                />
                {!s.dashed &&
                  labels.length <= 31 &&
                  s.values.map((v, j) =>
                    v === null ? null : (
                      <circle
                        key={j}
                        cx={xAt(j)}
                        cy={y(v)}
                        r={hover === j ? 5 : 3.5}
                        fill="var(--surface)"
                        stroke={color}
                        strokeWidth="2"
                      />
                    ),
                  )}
              </g>
            );
          })}
          {hover !== null && (
            <line
              x1={xAt(hover)}
              x2={xAt(hover)}
              y1={M.top}
              y2={height - M.bottom}
              className={styles.cursor}
            />
          )}
        </svg>
        {hover !== null && (
          <ChartTip
            x={xAt(hover)}
            title={labels[hover] ?? ''}
            rows={series.map((s, i) => {
              const v = s.values[hover];
              return {
                name: s.name,
                value: v === null || v === undefined ? '-' : formatY(v),
                color: seriesColor(s, i),
              };
            })}
          />
        )}
        <span className="sr-only" aria-live="polite">
          {hover !== null
            ? `${labels[hover]}: ${series
                .map((s) => {
                  const v = s.values[hover];
                  return `${s.name} ${v === null || v === undefined ? '없음' : formatY(v)}`;
                })
                .join(', ')}`
            : ''}
        </span>
      </div>
      <DataTable label={label} labels={labels} series={series} formatY={formatY} />
    </figure>
  );
}

export interface BarChartProps extends ChartBaseProps {
  values: readonly number[];
  /** Series name for the tooltip/table (e.g. "노출 수"). */
  name: string;
  color?: string;
  /** Index of a bar to emphasise (others are drawn soft). */
  highlightIndex?: number;
  /** Extra node under the chart. */
  footer?: ReactNode;
}

/** Simple responsive SVG bar chart. */
export function BarChart({
  values,
  name,
  labels,
  height = 220,
  formatY = (v) => v.toLocaleString('ko-KR'),
  label,
  zeroBased = true,
  color = 'var(--brand)',
  highlightIndex,
  footer,
  className,
}: BarChartProps) {
  const [ref, width] = useElementWidth(640);
  const [hover, setHover] = useState<number | null>(null);
  const { ticks, y, band } = useScale([...values], height, width, labels.length, zeroBased);
  const base = y(Math.max(0, ticks[0] ?? 0));
  const barW = Math.min(40, band * 0.6);
  const xAt = (i: number) => M.left + band * i + band / 2;
  return (
    <figure className={cx(styles.chart, className)}>
      <div
        ref={ref}
        className={styles.plot}
        style={{ height }}
        tabIndex={0}
        role="group"
        aria-label={`${label} — 좌우 화살표 키로 값을 탐색할 수 있어요`}
        onMouseLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') setHover((h) => Math.min(labels.length - 1, (h ?? -1) + 1));
          else if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? labels.length) - 1));
        }}
      >
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <Axes ticks={ticks} y={y} width={width} formatY={formatY} />
          <XLabels labels={labels} xAt={xAt} height={height} width={width} />
          {values.map((v, i) => {
            const top = y(v);
            const soft = highlightIndex !== undefined ? i !== highlightIndex : false;
            return (
              <g key={i} onMouseEnter={() => setHover(i)}>
                <rect
                  x={M.left + band * i}
                  y={M.top}
                  width={band}
                  height={height - M.top - M.bottom}
                  fill="transparent"
                />
                <rect
                  x={xAt(i) - barW / 2}
                  y={Math.min(top, base)}
                  width={barW}
                  height={Math.max(1, Math.abs(base - top))}
                  rx={Math.min(4, barW / 2)}
                  fill={color}
                  opacity={soft && hover !== i ? 0.35 : 1}
                />
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <ChartTip
            x={xAt(hover)}
            title={labels[hover] ?? ''}
            rows={[{ name, value: formatY(values[hover] ?? 0), color }]}
          />
        )}
        <span className="sr-only" aria-live="polite">
          {hover !== null ? `${labels[hover]}: ${name} ${formatY(values[hover] ?? 0)}` : ''}
        </span>
      </div>
      {footer}
      <DataTable label={label} labels={labels} series={[{ name, values }]} formatY={formatY} />
    </figure>
  );
}
