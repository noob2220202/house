import styles from './DealCount.module.css';
import { cx } from '../lib/cx';

export interface DealCounts {
  presale: number;
  sale: number;
  jeonse: number;
  monthly: number;
}

export interface DealCountProps {
  counts: DealCounts;
  /** For dark (ink) surfaces. */
  ink?: boolean;
  className?: string;
}

const CELLS = [
  { key: 'presale', short: '분', long: '분양' },
  { key: 'sale', short: '매', long: '매매' },
  { key: 'jeonse', short: '전', long: '전세' },
  { key: 'monthly', short: '월', long: '월세' },
] as const;

/** 4-cell deal count 분/매/전/월 — one component for map list, ranking, broker profile and admin. */
export function DealCount({ counts, ink, className }: DealCountProps) {
  const label = CELLS.map((c) => `${c.long} ${counts[c.key]}건`).join(', ');
  return (
    <span className={cx(styles.kcount, ink && styles.ink, className)} role="img" aria-label={label}>
      {CELLS.map((c) => (
        <span
          key={c.key}
          className={cx(styles[c.key], counts[c.key] === 0 && styles.zero)}
          aria-hidden="true"
        >
          <em>{c.short}</em>
          <b>{counts[c.key].toLocaleString('ko-KR')}</b>
        </span>
      ))}
    </span>
  );
}
