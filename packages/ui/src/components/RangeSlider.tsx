'use client';
import { useId, type CSSProperties } from 'react';
import styles from './RangeSlider.module.css';
import { cx } from '../lib/cx';
import { useControllable } from '../lib/hooks';

export interface RangeSliderProps {
  /** Group label, e.g. "매매가". */
  label: string;
  min: number;
  max: number;
  step?: number;
  value?: readonly [number, number];
  defaultValue?: readonly [number, number];
  onChange?: (value: [number, number]) => void;
  /** Called on pointer/keyboard release — use for expensive updates (URL, fetch). */
  onCommit?: (value: [number, number]) => void;
  /** Formats a bound for display + aria-valuetext (e.g. 억/만 price, 평). */
  formatValue?: (value: number) => string;
  /** Text shown when the upper bound is at `max` (e.g. "최대"). */
  maxLabel?: string;
  /** Hide the "lo ~ hi" readout. */
  hideReadout?: boolean;
  className?: string;
}

/** Two-thumb range slider built on native range inputs (keyboard + touch friendly). */
export function RangeSlider({
  label,
  min,
  max,
  step = 1,
  value,
  defaultValue,
  onChange,
  onCommit,
  formatValue = String,
  maxLabel,
  hideReadout,
  className,
}: RangeSliderProps) {
  const [range, setRange] = useControllable<readonly [number, number]>(
    value,
    defaultValue ?? [min, max],
    (v) => onChange?.([v[0], v[1]]),
  );
  const id = useId();
  const [lo, hi] = range;
  const pct = (v: number) => ((v - min) / (max - min || 1)) * 100;
  const text = (v: number) => (maxLabel && v >= max ? maxLabel : formatValue(v));
  const commit = () => onCommit?.([lo, hi]);
  return (
    <div className={cx(styles.root, className)} role="group" aria-labelledby={`${id}-l`}>
      <div className={styles.head}>
        <span id={`${id}-l`} className={styles.label}>
          {label}
        </span>
        {!hideReadout && (
          <output className={styles.readout}>
            {lo <= min && hi >= max ? '전체' : `${text(lo)} ~ ${text(hi)}`}
          </output>
        )}
      </div>
      <div
        className={styles.track}
        style={{ '--lo': `${pct(lo)}%`, '--hi': `${pct(hi)}%` } as CSSProperties}
      >
        <input
          type="range"
          className={styles.input}
          min={min}
          max={max}
          step={step}
          value={lo}
          aria-label={`${label} 최소`}
          aria-valuetext={text(lo)}
          onChange={(e) => setRange([Math.min(Number(e.target.value), hi), hi])}
          onPointerUp={commit}
          onKeyUp={commit}
        />
        <input
          type="range"
          className={styles.input}
          min={min}
          max={max}
          step={step}
          value={hi}
          aria-label={`${label} 최대`}
          aria-valuetext={text(hi)}
          onChange={(e) => setRange([lo, Math.max(Number(e.target.value), lo)])}
          onPointerUp={commit}
          onKeyUp={commit}
        />
      </div>
    </div>
  );
}
