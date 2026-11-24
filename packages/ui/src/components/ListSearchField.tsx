'use client';
import { useEffect, useRef, useState } from 'react';
import styles from './ListSearchField.module.css';
import { cx } from '../lib/cx';
import { SearchField } from './Combobox';

export type ListSearchMode = 'typing' | 'submit';

export interface ListSearchFieldProps {
  /** Accessible label (visually hidden). */
  label: string;
  placeholder?: string;
  /** The applied term — usually the `q` of the URL. */
  value: string;
  /**
   * Called with the trimmed term when it differs from the applied one: `typing` after a pause,
   * `submit` at once on Enter or clear (use it to push vs. replace history, reset the page …).
   */
  onSearch: (term: string, mode: ListSearchMode) => void;
  /** Pause before a typing commit, ms. Default 300. */
  delay?: number;
  /** 34px round icon that opens into a field on focus or while it holds a term (panel headers). */
  collapsible?: boolean;
  maxLength?: number;
  id?: string;
  className?: string;
}

/**
 * Search box of a list or table toolbar, mirrored into the URL. It follows `value` changes from
 * outside (back button, 조건 초기화) without overwriting what is being typed.
 */
export function ListSearchField({
  label,
  placeholder,
  value,
  onSearch,
  delay = 300,
  collapsible,
  maxLength = 50,
  id,
  className,
}: ListSearchFieldProps) {
  const [text, setText] = useState(value);
  /** What this field last saw from outside or sent out itself. */
  const applied = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  useEffect(() => {
    if (value === applied.current) return;
    applied.current = value;
    if (timer.current) clearTimeout(timer.current);
    setText(value);
  }, [value]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const commit = (next: string, mode: ListSearchMode) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const term = next.trim();
    if (term === applied.current) return;
    applied.current = term;
    onSearchRef.current(term, mode);
  };

  return (
    <SearchField
      variant="field"
      autocomplete={false}
      id={id}
      label={label}
      placeholder={placeholder}
      value={text}
      maxLength={maxLength}
      onChange={(next) => {
        setText(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => commit(next, 'typing'), delay);
      }}
      onSubmit={(next) => commit(next, 'submit')}
      onClear={() => {
        setText('');
        commit('', 'submit');
      }}
      className={cx(
        styles.root,
        collapsible && styles.collapsible,
        text !== '' && styles.on,
        className,
      )}
    />
  );
}
