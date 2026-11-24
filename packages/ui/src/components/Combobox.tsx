'use client';
import {
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import styles from './Combobox.module.css';
import inputStyles from './Input.module.css';
import { cx } from '../lib/cx';
import { useDismiss } from '../lib/hooks';
import { Field } from './Field';
import { Icon } from '../icons/Icon';
import { Spinner } from './Spinner';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Secondary text on the right/under the label (e.g. "해룡면 신대리 · 단지"). */
  description?: string;
  /** Small leading node (icon/badge). */
  leading?: ReactNode;
}

interface ListState {
  open: boolean;
  active: number;
}

/** Shared listbox behaviour for Combobox and SearchField (WAI-ARIA combobox with list autocomplete). */
function useComboboxList(
  options: readonly ComboboxOption[],
  onSelect: (o: ComboboxOption) => void,
  onEnterWithoutOption?: () => void,
) {
  const [state, setState] = useState<ListState>({ open: false, active: -1 });
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const close = () => setState({ open: false, active: -1 });
  useDismiss(state.open, close, [rootRef]);
  const select = (o: ComboboxOption) => {
    onSelect(o);
    close();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (options.length === 0) return;
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      setState((s) => ({
        open: true,
        active: s.open
          ? (s.active + dir + options.length) % options.length
          : dir === 1
            ? 0
            : options.length - 1,
      }));
    } else if (e.key === 'Enter') {
      const o = state.open ? options[state.active] : undefined;
      if (o) {
        e.preventDefault();
        select(o);
      } else {
        onEnterWithoutOption?.();
        close();
      }
    } else if (e.key === 'Escape' && state.open) {
      e.preventDefault();
      close();
    }
  };
  const inputProps = {
    role: 'combobox' as const,
    'aria-expanded': state.open,
    'aria-controls': listId,
    'aria-autocomplete': 'list' as const,
    'aria-activedescendant':
      state.open && state.active >= 0 ? `${listId}-${state.active}` : undefined,
    autoComplete: 'off',
    onKeyDown,
    onFocus: () => setState((s) => ({ ...s, open: true })),
  };
  return { state, setState, listId, rootRef, select, inputProps };
}

interface ListProps {
  listId: string;
  label: string;
  options: readonly ComboboxOption[];
  active: number;
  loading?: boolean;
  emptyText?: ReactNode;
  onSelect: (o: ComboboxOption) => void;
  onHover: (index: number) => void;
  header?: ReactNode;
}

function OptionList({
  listId,
  label,
  options,
  active,
  loading,
  emptyText,
  onSelect,
  onHover,
  header,
}: ListProps) {
  return (
    <div className={styles.pop}>
      {header}
      <ul id={listId} role="listbox" aria-label={label} className={styles.list}>
        {options.map((o, i) => (
          <li
            key={o.value}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            className={cx(styles.option, i === active && styles.active)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(o)}
            onMouseEnter={() => onHover(i)}
          >
            {o.leading}
            <span className={styles.optLabel}>{o.label}</span>
            {o.description && <span className={styles.optDesc}>{o.description}</span>}
          </li>
        ))}
      </ul>
      {loading && (
        <p className={styles.note} role="status">
          <Spinner size={14} /> 검색 중…
        </p>
      )}
      {!loading && options.length === 0 && emptyText && <p className={styles.note}>{emptyText}</p>}
    </div>
  );
}

export interface ComboboxProps {
  label?: ReactNode;
  /** Accessible name when no visible label is given. */
  'aria-label'?: string;
  options: readonly ComboboxOption[];
  /** Text in the input (controlled). */
  inputValue: string;
  onInputChange: (value: string) => void;
  onSelect: (option: ComboboxOption) => void;
  placeholder?: string;
  loading?: boolean;
  /** Shown when there are no options (e.g. "검색 결과가 없어요"). */
  emptyText?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
  ref?: Ref<HTMLInputElement>;
  className?: string;
}

/** Autocomplete text field: filter/fetch options in the parent from `inputValue`, handle `onSelect`. */
export function Combobox({
  label,
  options,
  inputValue,
  onInputChange,
  onSelect,
  placeholder,
  loading,
  emptyText,
  help,
  error,
  required,
  disabled,
  name,
  id,
  ref,
  className,
  ...aria
}: ComboboxProps) {
  const auto = useId();
  const controlId = id ?? auto;
  const { state, setState, listId, rootRef, select, inputProps } = useComboboxList(
    options,
    onSelect,
  );
  const showPop =
    state.open && (options.length > 0 || loading || (!!emptyText && inputValue.trim() !== ''));
  const control = (
    <div ref={rootRef} className={cx(styles.root, className)}>
      <input
        ref={ref}
        id={controlId}
        name={name}
        type="text"
        className={cx(inputStyles.input, !!error && inputStyles.isError, styles.input)}
        value={inputValue}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-label={aria['aria-label']}
        onChange={(e) => {
          onInputChange(e.target.value);
          setState({ open: true, active: -1 });
        }}
        {...inputProps}
        aria-expanded={showPop}
      />
      <Icon name="chevron-down" size={18} className={styles.caret} />
      {showPop && (
        <OptionList
          listId={listId}
          label={aria['aria-label'] ?? '추천 항목'}
          options={options}
          active={state.active}
          loading={loading}
          emptyText={emptyText}
          onSelect={select}
          onHover={(i) => setState((s) => ({ ...s, active: i }))}
        />
      )}
    </div>
  );
  if (!label && !help && !error) return control;
  return (
    <Field label={label} htmlFor={controlId} required={required} help={help} error={error}>
      {control}
    </Field>
  );
}

export interface SearchFieldProps {
  /**
   * `hero` = 64px brand-bordered search with a 검색 button; `pill` = 44px grey header pill;
   * `field` = 40px white bordered pill for list toolbars.
   */
  variant?: 'hero' | 'pill' | 'field';
  /** Accessible label (visually hidden). */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Submit (Enter without a highlighted suggestion, or the 검색 button). */
  onSubmit?: (value: string) => void;
  placeholder?: string;
  /** Autocomplete suggestions (optional). */
  options?: readonly ComboboxOption[];
  onSelect?: (option: ComboboxOption) => void;
  loading?: boolean;
  emptyText?: ReactNode;
  /** Node above the suggestion list (e.g. "최근 검색"). */
  listHeader?: ReactNode;
  submitLabel?: string;
  id?: string;
  name?: string;
  className?: string;
  /**
   * `false` = plain search box (no combobox/listbox semantics; `options` are ignored).
   * Default true.
   */
  autocomplete?: boolean;
  /** Shows a 검색어 지우기 (×) button while there is text; Escape clears too. */
  onClear?: () => void;
  clearLabel?: string;
  maxLength?: number;
  inputRef?: Ref<HTMLInputElement>;
}

const NO_OPTIONS: readonly ComboboxOption[] = [];

/** Search input with optional autocomplete — hero search and header pill. */
export function SearchField({
  variant = 'hero',
  label,
  value,
  onChange,
  onSubmit,
  placeholder,
  options = NO_OPTIONS,
  onSelect,
  loading,
  emptyText,
  listHeader,
  submitLabel = '검색',
  id,
  name = 'q',
  className,
  autocomplete = true,
  onClear,
  clearLabel = '검색어 지우기',
  maxLength,
  inputRef,
}: SearchFieldProps) {
  const auto = useId();
  const controlId = id ?? auto;
  const { state, setState, listId, rootRef, select, inputProps } = useComboboxList(options, (o) =>
    onSelect?.(o),
  );
  const showPop =
    autocomplete &&
    state.open &&
    (options.length > 0 || !!loading || (!!emptyText && value.trim() !== ''));
  const localInput = useRef<HTMLInputElement | null>(null);
  const setInputRef = (node: HTMLInputElement | null) => {
    localInput.current = node;
    if (typeof inputRef === 'function') inputRef(node);
    else if (inputRef) inputRef.current = node;
  };
  const clearable = !!onClear && value !== '';
  const clear = () => {
    onClear?.();
    setState({ open: false, active: -1 });
    localInput.current?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && !showPop && clearable) {
      e.preventDefault();
      e.stopPropagation();
      clear();
      return;
    }
    if (autocomplete) inputProps.onKeyDown(e);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit?.(value);
    setState({ open: false, active: -1 });
  };
  return (
    <div ref={rootRef} className={cx(styles.searchRoot, className)}>
      <form
        role="search"
        className={
          variant === 'hero' ? styles.hero : variant === 'field' ? styles.field : styles.pill
        }
        onSubmit={submit}
      >
        <label className="sr-only" htmlFor={controlId}>
          {label}
        </label>
        <Icon name="search" size={variant === 'hero' ? 24 : 18} className={styles.searchIcon} />
        <input
          id={controlId}
          name={name}
          type="search"
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          enterKeyHint="search"
          onChange={(e) => {
            onChange(e.target.value);
            if (autocomplete) setState({ open: true, active: -1 });
          }}
          {...(autocomplete ? inputProps : { autoComplete: 'off' })}
          {...(autocomplete ? { 'aria-expanded': showPop } : null)}
          ref={setInputRef}
          onKeyDown={onKeyDown}
        />
        {clearable && (
          <button type="button" className={styles.clear} aria-label={clearLabel} onClick={clear}>
            <Icon name="close" size={variant === 'hero' ? 18 : 16} />
          </button>
        )}
        {variant === 'hero' && (
          <button type="submit" className={styles.heroBtn}>
            {submitLabel}
          </button>
        )}
      </form>
      {showPop && (
        <OptionList
          listId={listId}
          label={`${label} 추천`}
          options={options}
          active={state.active}
          loading={loading}
          emptyText={emptyText}
          onSelect={select}
          onHover={(i) => setState((s) => ({ ...s, active: i }))}
          header={listHeader}
        />
      )}
    </div>
  );
}
