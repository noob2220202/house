'use client';
import { Field, Icon, SegmentedControl, cx } from '@house/ui';
import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  activeBlock,
  applyBlock,
  continueList,
  insertLink,
  type BlockCommand,
  type EditState,
} from '../lib/markup';
import styles from './MarkupEditor.module.css';
import { RichPreview } from './RichPreview';

export interface MarkupEditorProps {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  required?: boolean;
  error?: ReactNode;
  help?: ReactNode;
  maxLength?: number;
  placeholder?: string;
  /** Textarea rows (default 12). */
  rows?: number;
  /** Adds a 편집 / 미리보기 switch inside the editor (drawers; pages render their own preview). */
  previewToggle?: boolean;
  id?: string;
}

const TOOLS: { command: Exclude<BlockCommand, 'plain'>; label: string; glyph: string }[] = [
  { command: 'h2', label: '제목', glyph: 'H1' },
  { command: 'h3', label: '소제목', glyph: 'H2' },
  { command: 'bullet', label: '글머리 목록', glyph: '•' },
  { command: 'ordered', label: '번호 목록', glyph: '1.' },
];

/**
 * Content editor with a "safe subset" toolbar. It edits PLAIN TEXT markup ("## 제목", "- 항목",
 * "1. 항목", bare links) — the format the user site renders — so there is no HTML to sanitize.
 * Ctrl/⌘+Alt+1 · 2 headings, Ctrl/⌘+Shift+8 · 7 lists; Enter continues a list.
 */
export function MarkupEditor({
  label,
  value,
  onChange,
  onBlur,
  required,
  error,
  help,
  maxLength,
  placeholder,
  rows = 12,
  previewToggle,
  id,
}: MarkupEditorProps) {
  const auto = useId();
  const controlId = id ?? auto;
  const ref = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<{ start: number; end: number } | null>(null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [active, setActive] = useState<BlockCommand>('plain');

  // Restore the selection after a toolbar command replaced the value.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !pending.current) return;
    el.focus();
    el.setSelectionRange(pending.current.start, pending.current.end);
    pending.current = null;
  }, [value]);

  const read = (): EditState | null => {
    const el = ref.current;
    return el ? { value: el.value, start: el.selectionStart, end: el.selectionEnd } : null;
  };
  const commit = (next: EditState) => {
    pending.current = { start: next.start, end: next.end };
    setActive(activeBlock(next));
    if (next.value === value) {
      ref.current?.focus();
      ref.current?.setSelectionRange(next.start, next.end);
      pending.current = null;
    } else onChange(next.value);
  };
  const run = (command: BlockCommand) => {
    const state = read();
    if (state) commit(applyBlock(state, command));
  };
  const syncActive = useCallback(() => {
    const el = ref.current;
    if (el)
      setActive(activeBlock({ value: el.value, start: el.selectionStart, end: el.selectionEnd }));
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Enter' && !e.shiftKey && !mod && !e.altKey) {
      const state = read();
      const next = state ? continueList(state) : null;
      if (next) {
        e.preventDefault();
        commit(next);
      }
      return;
    }
    if (!mod) return;
    const command: BlockCommand | null =
      e.altKey && e.code === 'Digit1'
        ? 'h2'
        : e.altKey && e.code === 'Digit2'
          ? 'h3'
          : e.shiftKey && e.code === 'Digit8'
            ? 'bullet'
            : e.shiftKey && e.code === 'Digit7'
              ? 'ordered'
              : null;
    if (command) {
      e.preventDefault();
      run(command);
    }
  };

  const over = maxLength !== undefined && value.length > maxLength;
  const previewing = previewToggle && mode === 'preview';

  return (
    <Field
      label={label}
      htmlFor={controlId}
      required={required}
      error={error}
      help={help}
      errorId={`${controlId}-error`}
      helpId={`${controlId}-help`}
    >
      <div className={cx(styles.editor, !!error && styles.isError)}>
        <div className={styles.toolbar} role="toolbar" aria-label="서식">
          {TOOLS.map((tool) => (
            <button
              key={tool.command}
              type="button"
              className={styles.tool}
              aria-pressed={active === tool.command}
              disabled={previewing}
              onClick={() => run(tool.command)}
            >
              <span className={styles.glyph} aria-hidden="true">
                {tool.glyph}
              </span>
              {tool.label}
            </button>
          ))}
          <span className={styles.sep} aria-hidden="true" />
          <button
            type="button"
            className={styles.tool}
            disabled={previewing}
            onClick={() => {
              const state = read();
              if (state) commit(insertLink(state));
            }}
          >
            <Icon name="link" size={16} />
            링크
          </button>
          {previewToggle && (
            <SegmentedControl
              className={styles.modes}
              label="편집 화면 전환"
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'edit', label: '편집' },
                { value: 'preview', label: '미리보기' },
              ]}
            />
          )}
        </div>
        {previewing ? (
          <div className={styles.preview} style={{ minHeight: rows * 26 + 28 }}>
            <RichPreview source={value} compact />
          </div>
        ) : (
          <textarea
            ref={ref}
            id={controlId}
            className={styles.area}
            rows={rows}
            value={value}
            placeholder={placeholder}
            aria-invalid={error ? true : undefined}
            aria-required={required || undefined}
            aria-describedby={error ? `${controlId}-error` : help ? `${controlId}-help` : undefined}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            onKeyUp={syncActive}
            onClick={syncActive}
            onSelect={syncActive}
          />
        )}
        <div className={styles.foot}>
          <span className={styles.hint}>
            <code>## 제목</code> <code>- 목록</code> <code>1. 번호</code> · 주소(https://…)는
            자동으로 링크가 돼요
          </span>
          {/* Not a live region: announcing the count on every key drowns out what is typed. */}
          <span className={cx(styles.counter, over && styles.over)}>
            {value.length.toLocaleString('ko-KR')}
            {maxLength !== undefined && ` / ${maxLength.toLocaleString('ko-KR')}자`}
          </span>
          <span className="sr-only" aria-live="polite">
            {over && maxLength !== undefined
              ? `${maxLength.toLocaleString('ko-KR')}자를 넘었어요.`
              : ''}
          </span>
        </div>
      </div>
    </Field>
  );
}
