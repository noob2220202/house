'use client';
import { MoneyInput as UiMoneyInput, manwonHint } from '@house/ui';
import { parseMoney } from '../../lib/form-common';

export interface MoneyInputProps {
  id: string;
  /** Form value: the typed 만원 amount as text ("44,500"); "" when empty. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  'aria-label'?: string;
  required?: boolean;
  /** Show the "= 4억 4,500만원" reading under the input. */
  readout?: boolean;
}

const toText = (n: number | null) => (n === null ? '' : n.toLocaleString('ko-KR'));

/**
 * 만원 amount field of the 내놓기 · 구하기 forms = the shared @house/ui MoneyInput (same typing,
 * "4억 4,500" parsing, caret and readout as the broker console). Only adapts the forms' text value.
 */
export function MoneyInput({
  id,
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  required,
  readout,
  'aria-label': ariaLabel,
}: MoneyInputProps) {
  return (
    <UiMoneyInput
      id={id}
      value={parseMoney(value) ?? null}
      onValueChange={(n) => onChange(toText(n))}
      hint={readout ? manwonHint : undefined}
      error={error}
      placeholder={placeholder}
      required={required}
      inputProps={{ onBlur, 'aria-label': ariaLabel, enterKeyHint: 'next' }}
    />
  );
}
