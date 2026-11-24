'use client';
import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import styles from './Dropzone.module.css';
import { cx } from '../lib/cx';
import { Icon } from '../icons/Icon';

export interface DropzoneProps {
  /** Called with the chosen/dropped files. Upload logic lives in the caller (media API). */
  onFiles: (files: File[]) => void;
  /** `accept` attribute, e.g. "image/jpeg,image/png,image/webp". */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Main line; default "이미지를 끌어다 놓거나 클릭해서 선택". */
  title?: ReactNode;
  /** Spec/hint line (size, ratio, max count). */
  hint?: ReactNode;
  error?: ReactNode;
  /** Accessible name of the file input. */
  label?: string;
  className?: string;
}

/** Upload drop area (UI only): click, keyboard and drag & drop. */
export function Dropzone({
  onFiles,
  accept,
  multiple,
  disabled,
  title,
  hint,
  error,
  label = '파일 선택',
  className,
}: DropzoneProps) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const emit = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    onFiles(multiple ? files : files.slice(0, 1));
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!disabled) emit(e.dataTransfer.files);
  };
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={cx(
          styles.zone,
          over && styles.over,
          disabled && styles.disabled,
          !!error && styles.error,
        )}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          className={styles.input}
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          onChange={(e) => {
            emit(e.target.files);
            e.target.value = '';
          }}
        />
        <Icon name="upload" size={28} className={styles.icon} />
        <span className={styles.title}>
          {title ?? (
            <>
              파일을 끌어다 놓거나 <b>클릭해서 선택</b>
            </>
          )}
        </span>
        {hint && (
          <span className={styles.hint} id={`${id}-hint`}>
            {hint}
          </span>
        )}
      </label>
      {error && (
        <p className={styles.errorText} id={`${id}-err`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
