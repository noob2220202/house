import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import styles from './Checkbox.module.css';
import { cx } from '../lib/cx';

interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Visible label. For a label-less control pass `aria-label`. */
  children?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

export type CheckboxProps = ChoiceProps;

export function Checkbox({ children, className, ref, ...rest }: CheckboxProps) {
  return (
    <label className={cx(styles.check, rest.disabled && styles.disabled, className)}>
      <input ref={ref} type="checkbox" {...rest} />
      <svg
        className={styles.mark}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </svg>
      {children && <span>{children}</span>}
    </label>
  );
}

export type RadioProps = ChoiceProps;

export function Radio({ children, className, ref, ...rest }: RadioProps) {
  return (
    <label className={cx(styles.check, rest.disabled && styles.disabled, className)}>
      <input ref={ref} type="radio" {...rest} />
      {children && <span>{children}</span>}
    </label>
  );
}

export interface RadioGroupProps<T extends string = string> {
  /** Group label (rendered as legend, visually hidden when `hideLabel`). */
  label: ReactNode;
  hideLabel?: boolean;
  name: string;
  options: readonly { value: T; label: ReactNode; disabled?: boolean }[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  /** Lay options out in a row (default) or a column. */
  direction?: 'row' | 'column';
  className?: string;
}

export function RadioGroup<T extends string = string>({
  label,
  hideLabel,
  name,
  options,
  value,
  defaultValue,
  onChange,
  direction = 'row',
  className,
}: RadioGroupProps<T>) {
  return (
    <fieldset className={cx(styles.group, direction === 'column' && styles.column, className)}>
      <legend className={hideLabel ? 'sr-only' : styles.legend}>{label}</legend>
      {options.map((o) => (
        <Radio
          key={o.value}
          name={name}
          value={o.value}
          disabled={o.disabled}
          {...(value !== undefined
            ? { checked: value === o.value }
            : { defaultChecked: defaultValue === o.value })}
          onChange={() => onChange?.(o.value)}
        >
          {o.label}
        </Radio>
      ))}
    </fieldset>
  );
}

export type SwitchProps = ChoiceProps;

/** Toggle switch (role="switch"). */
export function Switch({ children, className, ref, ...rest }: SwitchProps) {
  return (
    <label className={cx(styles.switch, rest.disabled && styles.disabled, className)}>
      <input ref={ref} type="checkbox" role="switch" {...rest} />
      {children && <span className={styles.switchLabel}>{children}</span>}
    </label>
  );
}
