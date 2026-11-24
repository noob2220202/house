import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import styles from './Button.module.css';
import { cx } from '../lib/cx';
import type { LinkAs } from '../lib/types';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ink' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** sm 36 · md 44 (default) · lg 56 */
  size?: ButtonSize;
  /** Full width. */
  block?: boolean;
  /** Fully rounded. */
  pill?: boolean;
  /** Shows a spinner, sets aria-busy and blocks clicks. */
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  /** Render as a link. Use with `linkAs={Link}` for client-side navigation. */
  href?: string;
  linkAs?: LinkAs;
  target?: string;
  rel?: string;
  ref?: Ref<HTMLButtonElement>;
}

/** Primary action component. One cobalt primary per view; secondary = white, emphasised secondary = ink. */
export function Button({
  variant = 'primary',
  size = 'md',
  block,
  pill,
  loading,
  iconLeft,
  iconRight,
  href,
  linkAs,
  target,
  rel,
  className,
  children,
  disabled,
  type = 'button',
  ref,
  ...rest
}: ButtonProps) {
  const cls = cx(
    styles.btn,
    styles[variant],
    size !== 'md' && styles[size],
    block && styles.block,
    pill && styles.pill,
    (disabled || loading) && styles.disabled,
    className,
  );
  const content = (
    <>
      {loading ? <Spinner size={size === 'sm' ? 14 : 18} /> : iconLeft}
      {children}
      {iconRight}
    </>
  );
  if (href !== undefined) {
    const Comp = linkAs ?? 'a';
    const inert = disabled || loading;
    const linkProps = {
      href,
      className: cls,
      target,
      rel: target === '_blank' ? (rel ?? 'noopener noreferrer') : rel,
      'aria-disabled': inert || undefined,
      tabIndex: inert ? -1 : undefined,
      'aria-label': rest['aria-label'],
      title: rest.title,
      id: rest.id,
    };
    return <Comp {...linkProps}>{content}</Comp>;
  }
  return (
    <button
      ref={ref}
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
}
