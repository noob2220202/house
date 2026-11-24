import { cx } from '@house/ui';
import type { AgencyDealCounts } from '../api/schemas';
import styles from './office.module.css';
import { formatCount } from '@/lib/format';

const CELLS = [
  { key: 'presale', label: '분양' },
  { key: 'sale', label: '매매' },
  { key: 'jeonse', label: '전세' },
  { key: 'monthly', label: '월세' },
] as const;

export interface DealCountBarProps {
  counts: AgencyDealCounts;
  size?: 'md' | 'lg';
  className?: string;
}

/**
 * Full-width 분양 / 매매 / 전세 / 월세 count row of the office profile (`.od .kcount`): the same
 * anatomy as `DealCount` from @house/ui, but with the long labels next to the numbers.
 */
export function DealCountBar({ counts, size = 'md', className }: DealCountBarProps) {
  const label = CELLS.map((c) => `${c.label} ${counts[c.key]}건`).join(', ');
  return (
    <span
      className={cx(styles.kcount, size === 'lg' && styles.lg, className)}
      role="img"
      aria-label={label}
    >
      {CELLS.map((c) => (
        <span
          key={c.key}
          className={cx(styles[c.key], counts[c.key] === 0 && styles.zero)}
          aria-hidden="true"
        >
          <em>{c.label}</em>
          <b>{formatCount(counts[c.key])}</b>
        </span>
      ))}
    </span>
  );
}
