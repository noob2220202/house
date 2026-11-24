import type { ReactNode } from 'react';
import styles from './Field.module.css';
import { cx } from '../lib/cx';

export interface FieldProps {
  label?: ReactNode;
  /** id of the control the label points to. */
  htmlFor?: string;
  required?: boolean;
  help?: ReactNode;
  error?: ReactNode;
  /** ids for aria-describedby wiring (help / error). */
  helpId?: string;
  errorId?: string;
  children: ReactNode;
  className?: string;
}

/** Label + control + help/error stack (`.field`). Input/Select/Textarea render it automatically when `label` is set. */
export function Field({
  label,
  htmlFor,
  required,
  help,
  error,
  helpId,
  errorId,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cx(styles.field, className)}>
      {label && (
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
          {required && (
            <span className={styles.req} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      ) : help ? (
        <p className={styles.help} id={helpId}>
          {help}
        </p>
      ) : null}
    </div>
  );
}
