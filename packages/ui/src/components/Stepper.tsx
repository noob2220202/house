import type { ReactNode } from 'react';
import styles from './Stepper.module.css';
import { cx } from '../lib/cx';
import { Icon } from '../icons/Icon';

export interface StepItem {
  label: ReactNode;
  description?: ReactNode;
}

export interface StepperProps {
  steps: readonly StepItem[];
  /** Zero-based index of the current step. */
  current: number;
  /** Accessible name, e.g. "내놓기 단계". */
  label: string;
  /** `vertical` = numbered list with descriptions (intro cards); `horizontal` = progress header (wizards). */
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

/** Step indicator for multi-step forms. */
export function Stepper({
  steps,
  current,
  label,
  orientation = 'horizontal',
  className,
}: StepperProps) {
  return (
    <ol
      aria-label={label}
      className={cx(styles.stepper, orientation === 'vertical' && styles.vertical, className)}
    >
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li
            key={i}
            className={cx(styles.step, styles[state])}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className={styles.dot}>
              {state === 'done' ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}
              <span className="sr-only">
                {state === 'done' ? ' 완료' : state === 'current' ? ' 진행 중' : ''}
              </span>
            </span>
            <span className={styles.text}>
              <span className={styles.label}>{s.label}</span>
              {s.description && <span className={styles.desc}>{s.description}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
