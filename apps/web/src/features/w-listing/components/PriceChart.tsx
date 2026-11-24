'use client';
import { cx } from '@house/ui';
import { useId, useState } from 'react';
import { formatDateShort, formatManwon, formatPriceAxis } from '@/lib/format';
import { linePath, type PriceChartModel } from '../lib/chart';
import styles from './price.module.css';

/** Axis label — the shared `formatPriceAxis`, so this axis reads like the complex page's. */
const axisLabel = (manwon: number) => formatPriceAxis(manwon);

export interface PriceChartProps {
  model: PriceChartModel;
  /** Asking price of this listing (만원) or null. */
  ask: number | null;
  /** Screen-reader summary of the chart. */
  caption: string;
  /** "매매" | "전세" */
  dealLabel: string;
}

/**
 * The design's chart: HTML grid + labels, an SVG median line, 실거래 dots and the dashed asking-price
 * line. Dots are focusable (keyboard / touch) and show a tooltip; the latest trade is shown by default.
 */
export function PriceChart({ model, ask, caption, dealLabel }: PriceChartProps) {
  const id = useId();
  const lastIndex = model.dots.length - 1;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const shown = activeIndex ?? (lastIndex >= 0 ? lastIndex : null);
  const tip = shown !== null ? model.dots[shown] : undefined;
  const askVisible = ask !== null && model.askY !== null && model.askY >= 0 && model.askY <= 100;

  return (
    <figure className={styles.chart} aria-labelledby={`${id}-cap`}>
      <figcaption id={`${id}-cap`} className="sr-only">
        {caption}
      </figcaption>
      <div className={styles.y} aria-hidden="true">
        {model.ticks.map((t) => (
          <span key={t.value} style={{ top: `${t.y}%` }}>
            {axisLabel(t.value)}
          </span>
        ))}
      </div>
      <div className={styles.plot} onMouseLeave={() => setActiveIndex(null)}>
        {model.ticks.map((t) => (
          <i key={t.value} className={styles.grid} style={{ top: `${t.y}%` }} aria-hidden="true" />
        ))}
        <svg
          className={styles.svg}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {askVisible && (
            <line
              x1="0"
              x2="100"
              y1={model.askY ?? 0}
              y2={model.askY ?? 0}
              className={styles.askLine}
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path
            d={linePath(model.line)}
            className={styles.line}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {model.dots.map((d, i) => (
          <button
            key={`${d.dealDate}-${i}`}
            type="button"
            tabIndex={-1}
            className={cx(
              styles.dot,
              i === lastIndex && styles.dotLast,
              i === shown && styles.dotOn,
            )}
            style={{ left: `${d.x}%`, top: `${d.y}%` }}
            aria-label={`${formatDateShort(d.dealDate)} ${dealLabel} 실거래 ${formatManwon(d.value)}${d.floor !== null ? `, ${d.floor}층` : ''}`}
            onMouseEnter={() => setActiveIndex(i)}
            onFocus={() => setActiveIndex(i)}
            onBlur={() => setActiveIndex(null)}
          />
        ))}
        {askVisible && (
          <span className={styles.ask} style={{ top: `${model.askY}%` }} aria-hidden="true">
            이 매물 <b className="num">{formatManwon(ask ?? 0)}</b>
          </span>
        )}
        {tip && (
          <span
            className={cx(
              styles.tip,
              activeIndex === null && styles.tipDefault,
              tip.x < 22 && styles.tipRight,
              tip.y > 62 && styles.tipUp,
            )}
            style={{ left: `${tip.x}%`, top: `${tip.y}%` }}
            aria-hidden="true"
          >
            <b className="num">{formatManwon(tip.value)}</b>
            {formatDateShort(tip.dealDate).slice(0, 5)} 실거래
            {tip.floor !== null ? ` · ${tip.floor}층` : ''}
          </span>
        )}
      </div>
      <div className={styles.x} aria-hidden="true">
        {model.xLabels.map((l) => (
          <span key={l.label} style={{ left: `${l.x}%` }}>
            {l.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
