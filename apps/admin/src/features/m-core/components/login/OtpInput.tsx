'use client';
import { cx } from '@house/ui';
import { useId, type Ref } from 'react';
import { sanitizeOtp } from '../../lib/otp';
import styles from './login.module.css';

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called once all digits are entered. */
  onComplete?: (value: string) => void;
  label?: string;
  hint?: string;
  error?: string | null;
  disabled?: boolean;
  autoFocus?: boolean;
  length?: number;
  ref?: Ref<HTMLInputElement>;
}

/**
 * One-time-code field: a single real `<input autocomplete="one-time-code">` (paste, password
 * managers and screen readers all work) drawn as six digit cells.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  label = '인증 코드',
  hint = '숫자 6자리',
  error,
  disabled,
  autoFocus,
  length = 6,
  ref,
}: OtpInputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div>
      <label htmlFor={id} className={styles.otpLabel}>
        {label}
        <span id={hintId} className={styles.otpHint}>
          {hint}
        </span>
      </label>
      <div className={cx(styles.otp, !!error && styles.error)}>
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cx(
              styles.otpCell,
              i < value.length && styles.filled,
              i === Math.min(value.length, length - 1) && styles.active,
              i === length / 2 && styles.otpGap,
            )}
          >
            {value[i] ?? (i === value.length ? <i className={styles.otpCaret} /> : null)}
          </span>
        ))}
        <input
          ref={ref}
          id={id}
          className={styles.otpInput}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d*"
          // No maxLength: it would cut a pasted "123 456" before the space is stripped.
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hintId}
          onChange={(e) => {
            const next = sanitizeOtp(e.target.value, length);
            onChange(next);
            if (next.length === length && next !== value) onComplete?.(next);
          }}
        />
      </div>
      {error && (
        <p id={errorId} className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
