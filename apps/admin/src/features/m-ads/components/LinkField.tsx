'use client';
import { Checkbox, Icon, Input, cx } from '@house/ui';
import { useId } from 'react';
import styles from './editor.module.css';
import { FormField } from './FormField';

export interface LinkFieldProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  newWindow: boolean;
  onNewWindowChange: (value: boolean) => void;
  error?: string;
}

/** 링크 URL (https:// or a site-relative path) + "새 창에서 열기". */
export function LinkField({
  value,
  onChange,
  onBlur,
  newWindow,
  onNewWindowChange,
  error,
}: LinkFieldProps) {
  const id = useId();
  return (
    <FormField
      label="링크 URL"
      htmlFor={id}
      error={error}
      errorId={`${id}-err`}
      help={value.trim() === '' ? '비워 두면 눌러도 이동하지 않아요.' : undefined}
      side={
        <Checkbox
          className={styles.checkSm}
          checked={newWindow}
          onChange={(e) => onNewWindowChange(e.target.checked)}
        >
          새 창에서 열기
        </Checkbox>
      }
    >
      <span className={styles.inIco}>
        <Icon name="link" size={18} />
        <Input
          id={id}
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https:// 또는 /map/apt"
          className={cx(styles.inMd, styles.num, !!error && styles.invalid)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      </span>
    </FormField>
  );
}
