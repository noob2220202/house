'use client';
import { Button, Spinner, cx, type ButtonProps } from '@house/ui';
import styles from './SoftButton.module.css';

export interface SoftButtonProps extends Omit<ButtonProps, 'disabled' | 'loading' | 'href'> {
  /** Nothing to do right now (e.g. no unread rows, pristine form): looks disabled, stays focusable. */
  unavailable?: boolean;
  /** Request in flight: spinner + aria-busy, clicks ignored, focus kept. */
  busy?: boolean;
}

/**
 * <Button> for actions that switch themselves off when used ("모두 읽음", "저장"). A native
 * `disabled` drops keyboard focus to <body> the moment the focused button turns off; this one uses
 * `aria-disabled` / `aria-busy`, ignores activation while inert, and keeps the focus where it was.
 */
export function SoftButton({
  unavailable,
  busy,
  onClick,
  iconLeft,
  size,
  className,
  ...rest
}: SoftButtonProps) {
  const inert = !!unavailable || !!busy;
  return (
    <Button
      {...rest}
      size={size}
      className={cx(styles.soft, className)}
      aria-disabled={inert || undefined}
      aria-busy={busy || undefined}
      iconLeft={busy ? <Spinner size={size === 'sm' ? 14 : 18} /> : iconLeft}
      onClick={(e) => {
        // Also stops the implicit form submission a submit button would trigger.
        if (inert) e.preventDefault();
        else onClick?.(e);
      }}
    />
  );
}
