import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import styles from './Chip.module.css';
import { cx } from '../lib/cx';
import type { LinkAs } from '../lib/types';
import { Icon } from '../icons/Icon';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  children: ReactNode;
  /** Selected look (brand soft). Sets aria-pressed on button chips. */
  selected?: boolean;
  /** Renders a trailing × remove button. */
  onRemove?: () => void;
  /** Label for the remove button, e.g. "신대지구 조건 삭제". */
  removeLabel?: string;
  onClick?: () => void;
  href?: string;
  linkAs?: LinkAs;
  /** `quick` = filled grey quick-search chip (home "많이 찾는"). */
  variant?: 'outline' | 'quick';
  iconLeft?: ReactNode;
}

/** Pill chip: static, toggle button, link or removable. */
export function Chip({
  children,
  selected,
  onRemove,
  removeLabel,
  onClick,
  href,
  linkAs,
  variant = 'outline',
  iconLeft,
  className,
  ...rest
}: ChipProps) {
  const cls = cx(
    styles.chip,
    variant === 'quick' && styles.quick,
    selected && styles.on,
    className,
  );
  if (onRemove) {
    return (
      <span className={cls}>
        {iconLeft}
        {children}
        <button
          type="button"
          className={styles.x}
          onClick={onRemove}
          aria-label={removeLabel ?? '삭제'}
        >
          <Icon name="close" size={14} />
        </button>
      </span>
    );
  }
  if (href !== undefined) {
    const Comp = linkAs ?? 'a';
    const props = {
      href,
      className: cx(cls, styles.action),
      'aria-current': selected ? ('true' as const) : undefined,
    };
    return (
      <Comp {...props}>
        {iconLeft}
        {children}
      </Comp>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        className={cx(cls, styles.action)}
        aria-pressed={selected}
        onClick={onClick}
        {...rest}
      >
        {iconLeft}
        {children}
      </button>
    );
  }
  return (
    <span className={cls}>
      {iconLeft}
      {children}
    </span>
  );
}

export interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Field name, e.g. "거래". */
  field: string;
  /** Current value label, e.g. "매매·전세" or "전체". */
  value: string;
  /** True when the filter deviates from its default. */
  active?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** Filter chip — always "field + value" so active filters describe themselves. Use as a FilterDropdown/Popover trigger. */
export function FilterChip({ field, value, active, className, ref, ...rest }: FilterChipProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx(styles.fchip, active && styles.set, className)}
      {...rest}
    >
      <span className={styles.k}>{field}</span>
      <span className={styles.v}>{value}</span>
      <Icon name="chevron-down" size={16} className={styles.caret} />
    </button>
  );
}
