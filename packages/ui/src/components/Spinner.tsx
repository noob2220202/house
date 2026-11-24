import styles from './Spinner.module.css';
import { cx } from '../lib/cx';

export interface SpinnerProps {
  size?: number;
  /** Accessible label; omit when the surrounding control already announces busy state. */
  label?: string;
  className?: string;
}

export function Spinner({ size = 20, label, className }: SpinnerProps) {
  return (
    <span
      className={cx(styles.spinner, className)}
      style={{ width: size, height: size }}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
