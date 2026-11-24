import type { ReactNode } from 'react';
import styles from './ChoiceChip.module.css';
import { cx } from '../lib/cx';
import { Icon } from '../icons/Icon';

export interface ChoiceChipProps {
  /** `radio` = single choice in a `role="radiogroup"`; `checkbox` = multi-select. */
  type: 'radio' | 'checkbox';
  name: string;
  value?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Small caption after the label ("보증금 + 월세"). */
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Pill option around a visually hidden native radio/checkbox (keyboard + form semantics for free).
 * Selected = brand-soft pill with a brand ring; checkboxes also show a check.
 */
export function ChoiceChip({
  type,
  name,
  value,
  checked,
  onChange,
  disabled,
  hint,
  children,
  className,
}: ChoiceChipProps) {
  return (
    <label
      className={cx(styles.chip, checked && styles.on, disabled && styles.disabled, className)}
    >
      <input
        className="sr-only"
        type={type}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {type === 'checkbox' && checked && <Icon name="check" size={16} className={styles.check} />}
      <span className={styles.text}>{children}</span>
      {hint && <small className={styles.hint}>{hint}</small>}
    </label>
  );
}
