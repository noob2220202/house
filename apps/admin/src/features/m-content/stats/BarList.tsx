import { cx } from '@house/ui';
import type { ReactNode } from 'react';
import { formatCount, formatPercent } from '@/lib/format';
import { ratio } from '../lib/stats';
import styles from './stats.module.css';

export interface BarItem {
  key: string;
  label: ReactNode;
  /** Small text after the label (path, unit…). */
  sub?: string;
  value: number;
  /** Bar colour class: the brand colour by default; deal-type colours only for deal types. */
  tone?: 'sale' | 'jeonse' | 'monthly' | 'presale' | 'soft';
}

/**
 * Ranked horizontal bars (magnitude → one hue). Every row shows its label and value as text, so
 * the bar is never the only carrier of information.
 */
export function BarList({
  items,
  unit = '',
  share = true,
  formatValue = formatCount,
  label,
}: {
  items: readonly BarItem[];
  unit?: string;
  /** Show each row's share of the total. */
  share?: boolean;
  formatValue?: (value: number) => string;
  /** Accessible name of the list. */
  label: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const sum = items.reduce((acc, i) => acc + i.value, 0);
  return (
    <ul className={styles.bars} aria-label={label}>
      {items.map((item) => (
        <li key={item.key} className={styles.bar}>
          <span className={styles.barLabel}>
            <span className={styles.barName}>{item.label}</span>
            {item.sub && <span className={styles.barSub}>{item.sub}</span>}
          </span>
          <span className={styles.barValue}>
            {formatValue(item.value)}
            {unit}
            {share && sum > 0 && (
              <span className={styles.barShare}>{formatPercent(ratio(item.value, sum), 0)}</span>
            )}
          </span>
          <span className={styles.track} aria-hidden="true">
            <span
              className={cx(styles.fill, item.tone && styles[item.tone])}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
