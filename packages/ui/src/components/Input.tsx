import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import styles from './Input.module.css';
import { cx } from '../lib/cx';
import { Field } from './Field';
import { Icon } from '../icons/Icon';

interface FieldBits {
  label?: ReactNode;
  help?: ReactNode;
  /** Error message — sets aria-invalid and the error style. */
  error?: ReactNode;
  /** Class for the outer field wrapper. */
  fieldClassName?: string;
}

function useFieldIds(id: string | undefined) {
  const auto = useId();
  const controlId = id ?? auto;
  return { controlId, helpId: `${controlId}-help`, errorId: `${controlId}-error` };
}

/**
 * `aria-describedby` of a control: its own error (else help) line first, then the ids the caller
 * passed (a live status line, a counter). Merged, never replaced, so neither side is lost.
 */
function describedByOf(
  own: { error: ReactNode; help: ReactNode; errorId: string; helpId: string },
  extra: string | undefined,
): string | undefined {
  const ids = [own.error ? own.errorId : own.help ? own.helpId : null, extra?.trim() || null];
  return ids.filter(Boolean).join(' ') || undefined;
}

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'>,
    FieldBits {
  /** Trailing unit text or node inside the input (만원, ㎡ …). */
  suffix?: ReactNode;
  /** Leading icon/node inside the input. */
  prefix?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

/** Text input (48px). Works with react-hook-form: `<Input label="연락처" error={errors.phone?.message} {...register('phone')} />`. */
export function Input({
  label,
  help,
  error,
  suffix,
  prefix,
  className,
  fieldClassName,
  id,
  required,
  ref,
  'aria-describedby': extraDescribedBy,
  ...rest
}: InputProps) {
  const { controlId, helpId, errorId } = useFieldIds(id);
  const describedBy = describedByOf({ error, help, errorId, helpId }, extraDescribedBy);
  const input = (
    <input
      ref={ref}
      id={controlId}
      className={cx(
        styles.input,
        !!error && styles.isError,
        !!suffix && styles.hasSuffix,
        !!prefix && styles.hasPrefix,
        className,
      )}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      aria-required={required || undefined}
      required={required}
      {...rest}
    />
  );
  const control =
    suffix || prefix ? (
      <span className={styles.affixWrap}>
        {prefix && <span className={styles.prefix}>{prefix}</span>}
        {input}
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </span>
    ) : (
      input
    );
  if (!label && !help && !error) return control;
  return (
    <Field
      label={label}
      htmlFor={controlId}
      required={required}
      help={help}
      error={error}
      helpId={helpId}
      errorId={errorId}
      className={fieldClassName}
    >
      {control}
    </Field>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldBits {
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({
  label,
  help,
  error,
  className,
  fieldClassName,
  id,
  required,
  ref,
  'aria-describedby': extraDescribedBy,
  ...rest
}: TextareaProps) {
  const { controlId, helpId, errorId } = useFieldIds(id);
  const control = (
    <textarea
      ref={ref}
      id={controlId}
      className={cx(styles.input, styles.textarea, !!error && styles.isError, className)}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedByOf({ error, help, errorId, helpId }, extraDescribedBy)}
      required={required}
      {...rest}
    />
  );
  if (!label && !help && !error) return control;
  return (
    <Field
      label={label}
      htmlFor={controlId}
      required={required}
      help={help}
      error={error}
      helpId={helpId}
      errorId={errorId}
      className={fieldClassName}
    >
      {control}
    </Field>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldBits {
  /** Options (or pass <option> children). */
  options?: readonly SelectOption[];
  placeholder?: string;
  ref?: Ref<HTMLSelectElement>;
}

/** Native select styled per design (keeps platform pickers on mobile). */
export function Select({
  label,
  help,
  error,
  options,
  placeholder,
  className,
  fieldClassName,
  id,
  required,
  children,
  ref,
  'aria-describedby': extraDescribedBy,
  ...rest
}: SelectProps) {
  const { controlId, helpId, errorId } = useFieldIds(id);
  const control = (
    <span className={styles.select}>
      <select
        ref={ref}
        id={controlId}
        className={cx(styles.input, !!error && styles.isError, className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedByOf({ error, help, errorId, helpId }, extraDescribedBy)}
        required={required}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <Icon name="chevron-down" size={18} className={styles.selectIcon} />
    </span>
  );
  if (!label && !help && !error) return control;
  return (
    <Field
      label={label}
      htmlFor={controlId}
      required={required}
      help={help}
      error={error}
      helpId={helpId}
      errorId={errorId}
      className={fieldClassName}
    >
      {control}
    </Field>
  );
}
