import type { ReactNode } from 'react';
import styles from './Callout.module.css';
import { cx } from '../lib/cx';
import { Icon, type IconName } from '../icons/Icon';

export type CalloutTone = 'info' | 'brand' | 'warn' | 'danger' | 'success' | 'muted';

export interface CalloutProps {
  /** `info` and `brand` share the brand-soft look (`brand` reads better for promotional hints). */
  tone?: CalloutTone;
  /** Leading icon. Defaults per tone; `null` hides it. */
  icon?: IconName | null;
  /** Bold first line. */
  title?: ReactNode;
  children?: ReactNode;
  /**
   * Announce changes to assistive tech: `role="status"` (polite), or `role="alert"` for `danger`.
   * Leave off for static explanations (`role="note"`).
   */
  live?: boolean;
  /** `sm` = 13px text and tighter padding (panels, side columns). */
  size?: 'sm' | 'md';
  className?: string;
}

const DEFAULT_ICON: Record<CalloutTone, IconName> = {
  info: 'info',
  brand: 'info',
  warn: 'alert',
  danger: 'x-circle',
  success: 'check-circle',
  muted: 'info',
};

/** Inline note: a soft tinted box with an icon for hints, privacy rules, rejections and warnings. */
export function Callout({
  tone = 'info',
  icon,
  title,
  children,
  live,
  size = 'md',
  className,
}: CalloutProps) {
  const iconName = icon === undefined ? DEFAULT_ICON[tone] : icon;
  const role = live ? (tone === 'danger' ? 'alert' : 'status') : 'note';
  return (
    <div
      className={cx(styles.callout, styles[tone], size === 'sm' && styles.sm, className)}
      role={role}
      data-tone={tone}
    >
      {iconName && <Icon name={iconName} size={size === 'sm' ? 16 : 18} className={styles.icon} />}
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children !== undefined && children !== null && children !== false && (
          <div className={styles.text}>{children}</div>
        )}
      </div>
    </div>
  );
}
