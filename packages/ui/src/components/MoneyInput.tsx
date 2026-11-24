'use client';
import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import styles from './MoneyInput.module.css';
import inputStyles from './Input.module.css';
import fieldStyles from './Field.module.css';
import { cx } from '../lib/cx';
import { useIsomorphicLayoutEffect } from '../lib/hooks';
import {
  formatManwonInput,
  formatManwonReading,
  manwonStepLabel,
  parseManwonInput,
} from '../lib/money';

/** Native input props passed through — e.g. react-hook-form's `register('price')` result. */
export type MoneyInputNativeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'value' | 'defaultValue' | 'type' | 'children' | 'required' | 'disabled' | 'placeholder'
> & { ref?: Ref<HTMLInputElement> };

export interface MoneyInputProps {
  id: string;
  /** Visible label. Without it, pass `inputProps={{ 'aria-label': … }}` or label it from outside. */
  label?: ReactNode;
  /** Amount in 만원, or null when empty / unparsable. */
  value: number | null;
  onValueChange: (manwon: number | null) => void;
  /** Readout next to the input, announced politely (`aria-live`). Try `hint={manwonHint}`. */
  hint?: (manwon: number | null) => ReactNode;
  /** Quick-add buttons in 만원 (e.g. `[10000, 5000, 1000]` → +1억 +5천 +1천) plus 지우기. */
  steps?: readonly number[];
  /** Upper bound in 만원. Default 100,000,000 (= 1조원). */
  max?: number;
  /** Error message; when unset, unparsable text shows a built-in message after blur. */
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Input fills the row and the readout moves under it (drawers, narrow columns). */
  fullWidth?: boolean;
  inputProps?: MoneyInputNativeProps;
  /** Forwarded to the `<input>` (react-hook-form `field.ref`, focus management). */
  ref?: Ref<HTMLInputElement>;
  className?: string;
}

const DEFAULT_MAX = 100_000_000;
const INVALID = '금액을 숫자로 입력해 주세요. (예: 4억 4,500 또는 44500)';

/** Ready-made `hint`: "= 4억 4,500만원" with the reading in bold brand numerals. */
export function manwonHint(manwon: number | null): ReactNode {
  if (manwon === null || manwon <= 0) return null;
  return (
    <>
      = <b>{formatManwonReading(manwon)}</b>
    </>
  );
}

const show = (n: number | null) => (n === null ? '' : n.toLocaleString('ko-KR'));

/** Index in `s` right after its `count`-th digit (caret position after reformatting). */
function caretAfterDigits(s: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < s.length; i++) {
    if (/\d/.test(s[i] ?? '')) seen += 1;
    if (seen === count) return i + 1;
  }
  return s.length;
}

function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (typeof ref === 'function') ref(node);
  else if (ref) ref.current = node;
}

/**
 * 만원 amount input: right-aligned tabular numerals, thousands separators while typing, a "만원"
 * suffix, "4억 4,500" style input, an optional live reading and quick-add steps.
 *
 * Controlled by number: `<MoneyInput id="price" value={n} onValueChange={setN} hint={manwonHint} />`.
 * react-hook-form: use a `Controller` (`value={field.value} onValueChange={field.onChange}
 * ref={field.ref} inputProps={{ name: field.name, onBlur: field.onBlur }}`).
 */
export function MoneyInput({
  id,
  label,
  value,
  onValueChange,
  hint,
  steps,
  max = DEFAULT_MAX,
  error,
  required,
  disabled,
  placeholder = '0',
  fullWidth,
  inputProps,
  ref,
  className,
}: MoneyInputProps) {
  const { ref: passRef, onChange: passChange, onBlur: passBlur, ...native } = inputProps ?? {};
  const clampParse = (t: string) => {
    const n = parseManwonInput(t);
    return n === null ? null : Math.min(max, n);
  };

  const [text, setText] = useState(() => show(value));
  const [seen, setSeen] = useState(value);
  const [touched, setTouched] = useState(false);
  // Follow `value` from outside (reset, quick fill) unless it is what the current text already says.
  if (value !== seen) {
    setSeen(value);
    if (value !== clampParse(text)) setText(show(value));
  }

  const inputEl = useRef<HTMLInputElement | null>(null);
  const caret = useRef<number | null>(null);
  useIsomorphicLayoutEffect(() => {
    const el = inputEl.current;
    if (caret.current === null || !el || document.activeElement !== el) return;
    el.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [text]);
  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      inputEl.current = node;
      assignRef(ref, node);
      assignRef(passRef, node);
    },
    [ref, passRef],
  );

  const commit = (next: string, n: number | null) => {
    setText(next);
    if (n !== value) onValueChange(n);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    let next = formatManwonInput(raw);
    let n = parseManwonInput(next);
    if (n !== null && n > max) {
      n = max;
      next = show(max);
    }
    if (next !== raw) {
      const before = raw.slice(0, e.target.selectionStart ?? raw.length).replace(/\D/g, '').length;
      caret.current = caretAfterDigits(next, before);
    }
    commit(next, n);
    if (passChange) {
      e.target.value = next;
      passChange(e);
    }
  };

  const onBlur = (e: FocusEvent<HTMLInputElement>) => {
    setTouched(true);
    const n = clampParse(text);
    if (n !== null && show(n) !== text) setText(show(n));
    passBlur?.(e);
  };

  const step = (amount: number) => {
    const n = Math.min(max, Math.max(0, (value ?? clampParse(text) ?? 0) + amount));
    commit(show(n), n);
  };

  const parsed = clampParse(text);
  const invalid = touched && text.trim() !== '' && parsed === null;
  const message = error ?? (invalid ? INVALID : undefined);
  const unitId = `${id}-unit`;
  const errorId = `${id}-error`;
  const readoutId = `${id}-readout`;
  const describedBy =
    [unitId, message ? errorId : null, native['aria-describedby']].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className={cx(styles.root, fullWidth && styles.full, className)}>
      {label && (
        <label className={fieldStyles.label} htmlFor={id}>
          {label}
          {required && (
            <span className={fieldStyles.req} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div className={styles.line}>
        <span className={cx(inputStyles.affixWrap, styles.control)}>
          <input
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="next"
            {...native}
            ref={setRefs}
            id={id}
            type="text"
            value={text}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            aria-required={required || undefined}
            aria-invalid={message ? true : native['aria-invalid']}
            aria-describedby={describedBy}
            className={cx(
              inputStyles.input,
              inputStyles.hasSuffix,
              styles.input,
              !!message && inputStyles.isError,
              native.className,
            )}
            onChange={onChange}
            onBlur={onBlur}
          />
          <span id={unitId} className={cx(inputStyles.suffix, styles.unit)}>
            만원
          </span>
        </span>
        {hint && (
          <span id={readoutId} className={styles.readout} aria-live="polite">
            {hint(parsed)}
          </span>
        )}
      </div>
      {steps && steps.length > 0 && (
        <div className={styles.steps} role="group" aria-label="금액 빠르게 입력">
          {steps.map((s) => (
            <button
              key={s}
              type="button"
              className={styles.step}
              disabled={disabled}
              aria-label={`${formatManwonReading(s)} 더하기`}
              onClick={() => step(s)}
            >
              {manwonStepLabel(s)}
            </button>
          ))}
          <button
            type="button"
            className={styles.step}
            disabled={disabled || text === ''}
            aria-label="금액 지우기"
            onClick={() => {
              commit('', null);
              inputEl.current?.focus();
            }}
          >
            지우기
          </button>
        </div>
      )}
      {message && (
        <p className={fieldStyles.error} id={errorId} role="alert" data-field-error="">
          {message}
        </p>
      )}
    </div>
  );
}
