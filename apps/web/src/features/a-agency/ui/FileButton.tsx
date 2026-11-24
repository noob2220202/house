'use client';
import { cx } from '@house/ui';
import { useId, type ReactNode } from 'react';
import styles from './ui.module.css';

export interface FileButtonProps {
  /** Visible content (text / icon). */
  children: ReactNode;
  /** Accessible name of the file input, e.g. "사업자등록증 파일 교체". */
  label: string;
  accept?: string;
  disabled?: boolean;
  onFile: (file: File) => void;
  /** `link` = brand text button, `outline` = small bordered button. */
  variant?: 'link' | 'outline';
  className?: string;
}

/** A button-looking file picker (single file). The native input stays focusable for keyboards. */
export function FileButton({
  children,
  label,
  accept,
  disabled,
  onFile,
  variant = 'outline',
  className,
}: FileButtonProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cx(styles.fileBtn, styles[variant], disabled && styles.fileDisabled, className)}
    >
      <input
        id={id}
        type="file"
        className={styles.fileInput}
        accept={accept}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
      {children}
    </label>
  );
}
