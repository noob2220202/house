'use client';
import { useState, type ReactNode } from 'react';
import styles from './FilterDropdown.module.css';
import { Button } from './Button';
import { FilterChip } from './Chip';
import { Popover } from './Popover';
import { Icon } from '../icons/Icon';

export interface FilterDropdownProps {
  /** Field name shown on the chip, e.g. "금액". */
  field: string;
  /** Current value label on the chip, e.g. "3억~5억" or "전체". */
  valueLabel: string;
  /** True when the filter is set (chip turns brand). */
  active?: boolean;
  /** Panel heading (defaults to `field`). */
  title?: string;
  children: ReactNode;
  /** Called when 적용 is pressed; the panel closes afterwards. */
  onApply?: () => void;
  /** Called when 초기화 is pressed (panel stays open). */
  onReset?: () => void;
  /** Called when the panel opens — sync your draft state from the applied state here. */
  onOpen?: () => void;
  applyLabel?: string;
  width?: number;
}

/** Filter chip + popover with 초기화 / 적용 footer. Keep draft state in the parent; commit on `onApply`. */
export function FilterDropdown({
  field,
  valueLabel,
  active,
  title,
  children,
  onApply,
  onReset,
  onOpen,
  applyLabel = '적용',
  width = 320,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) onOpen?.();
      }}
      label={`${title ?? field} 필터`}
      width={width}
      flush
      trigger={(p) => <FilterChip field={field} value={valueLabel} active={active} {...p} />}
    >
      <div className={styles.head}>
        <strong className={styles.title}>{title ?? field}</strong>
      </div>
      <div className={styles.body}>{children}</div>
      <div className={styles.foot}>
        {onReset && (
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<Icon name="refresh" size={16} />}
            onClick={onReset}
          >
            초기화
          </Button>
        )}
        <Button
          size="sm"
          className={styles.apply}
          onClick={() => {
            onApply?.();
            setOpen(false);
          }}
        >
          {applyLabel}
        </Button>
      </div>
    </Popover>
  );
}
