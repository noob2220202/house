'use client';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import styles from './SegmentedControl.module.css';
import { cx } from '../lib/cx';
import { useControllable } from '../lib/hooks';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  /** Accessible group name. */
  label: string;
  options: readonly SegmentOption<T>[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  /** `track` = grey pill track (평/㎡, sort); `pills` = free pills with ink selection (deal tabs above the hero search). */
  variant?: 'track' | 'pills';
  /** Selected segment colour on the track: white (default) or ink. */
  tone?: 'default' | 'ink';
  size?: 'sm' | 'md';
  className?: string;
}

/** Single-choice segmented control (radiogroup semantics, arrow-key navigation). */
export function SegmentedControl<T extends string = string>({
  label,
  options,
  value,
  defaultValue,
  onChange,
  variant = 'track',
  tone = 'default',
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  const [current, setCurrent] = useControllable<T | undefined>(
    value,
    defaultValue ?? options[0]?.value,
    (v) => {
      if (v !== undefined) onChange?.(v);
    },
  );
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!dir) return;
    e.preventDefault();
    const enabled = options.filter((o) => !o.disabled);
    const idx = enabled.findIndex((o) => o.value === current);
    const next = enabled[(idx + dir + enabled.length) % enabled.length];
    if (!next) return;
    setCurrent(next.value);
    ref.current
      ?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(next.value)}"]`)
      ?.focus();
  };
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      className={cx(
        variant === 'track' ? styles.seg : styles.pills,
        tone === 'ink' && styles.ink,
        size === 'sm' && styles.sm,
        className,
      )}
      onKeyDown={onKeyDown}
    >
      {options.map((o) => {
        const on = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            data-value={o.value}
            tabIndex={on ? 0 : -1}
            disabled={o.disabled}
            className={cx(styles.item, on && styles.on)}
            onClick={() => setCurrent(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
