import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import styles from './IconButton.module.css';
import { cx } from '../lib/cx';
import type { LinkAs } from '../lib/types';

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Required accessible name (icon-only control). */
  label: string;
  children: ReactNode;
  /** 44 (default) · 36 · 32 */
  size?: 44 | 36 | 32 | 52;
  /** `plain` has no border (headers, toolbars); `floating` adds a micro shadow (on photos/maps). */
  variant?: 'outline' | 'plain' | 'floating';
  /** Toggled state (e.g. liked): danger tint + aria-pressed. */
  pressed?: boolean;
  round?: boolean;
  href?: string;
  linkAs?: LinkAs;
  ref?: Ref<HTMLButtonElement>;
}

/** 44×44 icon-only button. */
export function IconButton({
  label,
  children,
  size = 44,
  variant = 'outline',
  pressed,
  round,
  href,
  linkAs,
  className,
  type = 'button',
  ref,
  ...rest
}: IconButtonProps) {
  const cls = cx(
    styles.btn,
    styles[variant],
    pressed && styles.on,
    round && styles.round,
    className,
  );
  const style = size === 44 ? undefined : { width: size, height: size };
  if (href !== undefined) {
    const Comp = linkAs ?? 'a';
    const linkProps = { href, className: cls, style, 'aria-label': label };
    return <Comp {...linkProps}>{children}</Comp>;
  }
  return (
    <button
      ref={ref}
      type={type}
      className={cls}
      style={style}
      aria-label={label}
      aria-pressed={pressed}
      {...rest}
    >
      {children}
    </button>
  );
}
