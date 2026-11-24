'use client';
import { Input } from '@house/ui';
import type { ReactNode } from 'react';

export interface NumberFieldProps {
  label: string;
  /** Raw text the user typed — the calculator parses it (keeps "4." while typing). */
  value: string;
  onChange: (value: string) => void;
  suffix?: ReactNode;
  placeholder?: string;
  help?: ReactNode;
  error?: string;
  /** Allow a decimal point. */
  decimal?: boolean;
  maxLength?: number;
}

/** Small numeric text field (rate %, months, years, area) that only accepts digits (and one dot). */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  placeholder,
  help,
  error,
  decimal,
  maxLength = 8,
}: NumberFieldProps) {
  return (
    <Input
      label={label}
      inputMode={decimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      maxLength={maxLength}
      onChange={(e) => {
        let next = e.target.value.replace(decimal ? /[^\d.]/g : /[^\d]/g, '');
        if (decimal) {
          const dot = next.indexOf('.');
          if (dot !== -1) next = next.slice(0, dot + 1) + next.slice(dot + 1).replace(/\./g, '');
        }
        onChange(next);
      }}
      suffix={suffix}
      help={help}
      error={error}
    />
  );
}
