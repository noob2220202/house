import type { ReactNode } from 'react';
import styles from './StatTile.module.css';
import { cx } from '../lib/cx';

export interface StatTileProps {
  label: ReactNode;
  /** Main figure (already formatted). */
  value: ReactNode;
  /** Small unit after the value: 명, 건, 곳. */
  unit?: ReactNode;
  /** Line under the value: delta, comparison, chips. */
  detail?: ReactNode;
  /** 32px icon tile in the top-right corner. */
  icon?: ReactNode;
  /** Icon tile tone. */
  iconTone?: 'neutral' | 'accent' | 'brand';
  href?: string;
  className?: string;
}

/** KPI tile (`.kpi`): label, big tabular figure, delta line. */
export function StatTile({
  label,
  value,
  unit,
  detail,
  icon,
  iconTone = 'neutral',
  className,
}: StatTileProps) {
  return (
    <div className={cx(styles.kpi, className)}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {detail && <span className={styles.detail}>{detail}</span>}
      {icon && <span className={cx(styles.icon, styles[iconTone])}>{icon}</span>}
    </div>
  );
}

export interface DeltaProps {
  /** Direction decides colour (KR convention: up red / down blue) unless `positiveIsGood` is set. */
  direction: 'up' | 'down' | 'flat';
  children: ReactNode;
  /** Use success green for "up" (admin KPIs like visitors). */
  good?: boolean;
  className?: string;
}

/** ▲ 8.6% style delta. */
export function Delta({ direction, children, good, className }: DeltaProps) {
  return (
    <span className={cx(styles.delta, good ? styles.good : styles[direction], className)}>
      {direction !== 'flat' && <span aria-hidden="true">{direction === 'up' ? '▲' : '▼'}</span>}
      <span className="sr-only">
        {direction === 'up' ? '증가 ' : direction === 'down' ? '감소 ' : ''}
      </span>
      {children}
    </span>
  );
}
