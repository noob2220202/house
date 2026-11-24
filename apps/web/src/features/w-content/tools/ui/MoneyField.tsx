'use client';
import { MoneyInput, manwonHint } from '@house/ui';
import { useId } from 'react';
import styles from '../tools.module.css';

export interface MoneyFieldProps {
  label: string;
  /** Amount in 만원, or null when empty. */
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  /** Extra help shown when the field is empty (otherwise the Korean reading is shown). */
  help?: string;
  error?: string;
  /** Quick-add buttons (만원). Default: +1억, +5천, +1천. Pass [] to hide. */
  steps?: readonly number[];
  /** Upper bound in 만원 (default 1조). */
  max?: number;
  required?: boolean;
}

const DEFAULT_STEPS = [10_000, 5_000, 1_000] as const;

/**
 * Money input of the calculators = the shared @house/ui MoneyInput: thousands separators while
 * typing, "4억 4,500" accepted, the Korean reading underneath and quick-add buttons for touch.
 */
export function MoneyField({
  label,
  value,
  onChange,
  placeholder = '0',
  help,
  error,
  steps = DEFAULT_STEPS,
  max = 100_000_000,
  required,
}: MoneyFieldProps) {
  const id = useId();
  return (
    <div className={styles.money}>
      <MoneyInput
        id={id}
        label={label}
        value={value}
        onValueChange={onChange}
        hint={(n) => (n !== null && n > 0 ? manwonHint(n) : (help ?? null))}
        steps={steps}
        max={max}
        error={error}
        required={required}
        placeholder={placeholder}
        fullWidth
      />
    </div>
  );
}
