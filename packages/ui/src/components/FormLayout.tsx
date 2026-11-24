import type { ReactNode } from 'react';
import styles from './FormLayout.module.css';
import { cx } from '../lib/cx';
import { Icon } from '../icons/Icon';

export interface FormSectionProps {
  /** Badge letter in the legend: A, B, C … (decorative, hidden from assistive tech). */
  letter: string;
  /** Legend text — names the group for screen readers. */
  title: ReactNode;
  /** Right-aligned caption in the legend row ("* 필수 항목"). */
  note?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Lettered `<fieldset>` of a long form or wizard step (A 매물 기본 정보, B 거래 조건 …).
 * Sections stack with an 8px grey divider. Padding and the label-column width can be tuned per
 * form with `--form-section-pad` and `--form-label-w` on any ancestor.
 */
export function FormSection({ letter, title, note, children, className }: FormSectionProps) {
  return (
    <fieldset className={cx(styles.section, className)}>
      <legend className={styles.legend}>
        <span className={styles.letter} aria-hidden="true">
          {letter}
        </span>
        <span className={styles.legendT}>{title}</span>
        {note && <span className={styles.note}>{note}</span>}
      </legend>
      <div className={styles.body}>{children}</div>
    </fieldset>
  );
}

export interface FormRowProps {
  label: ReactNode;
  /** id of the control the label points to. Omit for groups (radiogroup, chip list) and pass `labelId`. */
  htmlFor?: string;
  /** id for the label text so a group can use `aria-labelledby`. */
  labelId?: string;
  /** Shows a red `*` (visual) and " (필수)" (screen readers). */
  required?: boolean;
  /** Caption under the label. */
  help?: ReactNode;
  /** Error under the controls — for controls that do not render their own. */
  error?: ReactNode;
  /** id of the error text (point the group's `aria-describedby` at it). */
  errorId?: string;
  /** Extra mark next to the label (e.g. the 표시·광고 "명시사항" badge). */
  labelAside?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Label column + control column; stacks under ~640px (container) or on phones. */
export function FormRow({
  label,
  htmlFor,
  labelId,
  required,
  help,
  error,
  errorId,
  labelAside,
  children,
  className,
}: FormRowProps) {
  const text = (
    <>
      {label}
      {required && (
        <>
          <span className={styles.req} aria-hidden="true">
            *
          </span>
          <span className="sr-only"> (필수)</span>
        </>
      )}
    </>
  );
  return (
    <div className={cx(styles.row, className)}>
      <div className={styles.rowL}>
        {htmlFor ? (
          <label className={styles.label} htmlFor={htmlFor} id={labelId}>
            {text}
          </label>
        ) : (
          <span className={styles.label} id={labelId}>
            {text}
          </span>
        )}
        {labelAside}
        {help && <span className={styles.help}>{help}</span>}
      </div>
      <div className={styles.rowC}>
        {children}
        {error && <FieldError id={errorId}>{error}</FieldError>}
      </div>
    </div>
  );
}

export interface FieldErrorProps {
  id?: string;
  children: ReactNode;
  className?: string;
}

/** Red error line (`role="alert"`). `data-field-error` lets a form scroll to the first error. */
export function FieldError({ id, children, className }: FieldErrorProps) {
  return (
    <p className={cx(styles.error, className)} role="alert" id={id} data-field-error="">
      {children}
    </p>
  );
}

export interface HelpLineProps {
  icon?: 'info' | 'lock' | 'shield';
  children: ReactNode;
  id?: string;
  className?: string;
}

/** Muted caption with a small icon under a control ("연락처는 수락한 중개사에게만 공개돼요"). */
export function HelpLine({ icon = 'info', children, id, className }: HelpLineProps) {
  return (
    <p className={cx(styles.helpLine, className)} id={id}>
      <Icon name={icon} size={16} />
      <span>{children}</span>
    </p>
  );
}
