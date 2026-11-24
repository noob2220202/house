'use client';
import { niceTicks } from '@house/ui';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { axisLabelIndexes } from '../lib/stats';
import styles from './stats.module.css';

export interface TrendChartProps {
  /** Accessible title, e.g. "방문 추이 — 방문자". */
  label: string;
  /** Series name shown in the tooltip (the panel title names it too, so there is no legend). */
  name: string;
  /** Short x-axis labels ("11.24"), one per point. */
  labels: readonly string[];
  /** Tooltip titles ("11.24 (화)", "11.17 – 11.23"); defaults to `labels`. */
  titles?: readonly string[];
  values: readonly number[];
  format: (value: number) => string;
  unit?: string;
  height?: number;
}

const M = { top: 14, right: 22, bottom: 28, left: 52 };
const TIP_HALF = 76;

function usePlotWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => setWidth(el.clientWidth);
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/**
 * Single-series trend line for the 통계 screen: one y-axis starting at 0, recessive grid, a 2px
 * line with a soft area, an end marker, and a crosshair + tooltip on hover / touch / arrow keys.
 * X labels are thinned from the newest point backwards so they never collide. The numbers are
 * also available as a table (일별 수치) on the same screen.
 */
export function TrendChart({
  label,
  name,
  labels,
  titles = labels,
  values,
  format,
  unit = '',
  height = 248,
}: TrendChartProps) {
  const [ref, width] = usePlotWidth();
  const [active, setActive] = useState<number | null>(null);
  const gradient = useId();
  const n = values.length;
  const last = n - 1;

  const ticks = niceTicks(0, Math.max(1, ...values), 4);
  const yMax = ticks[ticks.length - 1] ?? 1;
  const plotW = Math.max(10, width - M.left - M.right);
  const plotH = height - M.top - M.bottom;
  const baseY = M.top + plotH;
  const x = (i: number) => M.left + (n <= 1 ? plotW / 2 : (i * plotW) / last);
  const y = (v: number) => M.top + (1 - v / yMax) * plotH;

  const line = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ');
  const area =
    n > 1 ? `${line} L${x(last).toFixed(1)} ${baseY} L${x(0).toFixed(1)} ${baseY} Z` : '';
  const shown = new Set(axisLabelIndexes(n, plotW));

  const pick = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const rel = (clientX - rect.left - M.left) / plotW;
    setActive(Math.max(0, Math.min(last, Math.round(rel * last))));
  };
  const onPointer = (e: PointerEvent<HTMLDivElement>) => pick(e.clientX);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (n === 0) return;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = Math.min(last, (active ?? -1) + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, (active ?? n) - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    else if (e.key === 'Escape') setActive(null);
    if (next === null) return;
    e.preventDefault();
    setActive(next);
  };

  const activeValue = active === null ? undefined : values[active];
  const tipX = active === null ? 0 : Math.max(TIP_HALF, Math.min(width - TIP_HALF, x(active)));

  return (
    <div
      ref={ref}
      className={styles.plot}
      style={{ height }}
      tabIndex={0}
      role="group"
      aria-label={`${label} 그래프 — 좌우 화살표 키로 값을 살펴볼 수 있어요`}
      onPointerMove={onPointer}
      onPointerDown={onPointer}
      onPointerLeave={() => setActive(null)}
      onBlur={() => setActive(null)}
      onKeyDown={onKeyDown}
    >
      {width > 0 && n > 0 && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <defs>
            <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--brand)" stopOpacity="0.16" />
              <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={M.left}
                x2={width - M.right}
                y1={y(t)}
                y2={y(t)}
                className={t === 0 ? styles.axis : styles.grid}
              />
              <text x={M.left - 10} y={y(t)} dy="0.35em" textAnchor="end" className={styles.tick}>
                {format(t)}
              </text>
            </g>
          ))}
          {labels.map((text, i) =>
            shown.has(i) ? (
              <text
                key={`${text}-${i}`}
                x={x(i)}
                y={height - 8}
                textAnchor="middle"
                className={styles.tick}
              >
                {text}
              </text>
            ) : null,
          )}
          {area && <path d={area} fill={`url(#${gradient})`} />}
          <path d={line} className={styles.line} />
          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={M.top} y2={baseY} className={styles.cursor} />
          )}
          <circle
            cx={x(active ?? last)}
            cy={y(values[active ?? last] ?? 0)}
            r={active === null ? 4 : 5}
            className={styles.dot}
          />
        </svg>
      )}
      {active !== null && activeValue !== undefined && (
        <div className={styles.tip} style={{ left: tipX }} aria-hidden="true">
          <span className={styles.tipTitle}>{titles[active] ?? labels[active]}</span>
          <span className={styles.tipRow}>
            <i className={styles.tipKey} />
            {name}
            <b>
              {format(activeValue)}
              {unit}
            </b>
          </span>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {active !== null && activeValue !== undefined
          ? `${titles[active] ?? labels[active]}: ${name} ${format(activeValue)}${unit}`
          : ''}
      </span>
    </div>
  );
}
