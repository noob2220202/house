import { cx } from '@house/ui';
import type { ReactNode } from 'react';
import styles from './editor.module.css';

export interface FormFieldProps {
  label: ReactNode;
  /** Small muted text after the label ("관리용"). */
  note?: ReactNode;
  /** Right side of the label row (checkbox, hint). */
  side?: ReactNode;
  /** Id of the control (renders a <label>); omit for groups and pass `labelId` instead. */
  htmlFor?: string;
  labelId?: string;
  required?: boolean;
  error?: ReactNode;
  errorId?: string;
  help?: ReactNode;
  children: ReactNode;
}

/** Compact form row of the edit drawer (design `.fld` / `.lb`): 13px bold label, control, inline error. */
export function FormField({
  label,
  note,
  side,
  htmlFor,
  labelId,
  required,
  error,
  errorId,
  help,
  children,
}: FormFieldProps) {
  const text = (
    <>
      {label}
      {required && (
        <span className={styles.req} aria-hidden="true">
          *
        </span>
      )}
      {note && <small>{note}</small>}
    </>
  );
  return (
    <div className={styles.fld}>
      <div className={cx(styles.lb, !!side && styles.lbRow)}>
        {htmlFor ? (
          <label htmlFor={htmlFor} id={labelId} className={styles.lb}>
            {text}
          </label>
        ) : (
          <span id={labelId} className={styles.lb}>
            {text}
          </span>
        )}
        {side}
      </div>
      {children}
      {help && !error && <p className={styles.help}>{help}</p>}
      {error && (
        <p id={errorId} className={styles.err} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
