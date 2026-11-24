import type { ReactNode } from 'react';
import styles from './Avatar.module.css';
import { cx } from '../lib/cx';

export interface AvatarProps {
  /** Person/office name — the first character is used as the fallback initial. */
  name: string;
  /** Image node (e.g. next/image with `fill`) — optional. */
  image?: ReactNode;
  size?: number;
  /** `ink` = dark tile with champagne initial (admin), `soft` = brand soft, `square` rounded tile for offices. */
  tone?: 'ink' | 'soft' | 'neutral';
  square?: boolean;
  className?: string;
}

export function Avatar({ name, image, size = 36, tone = 'ink', square, className }: AvatarProps) {
  return (
    <span
      className={cx(styles.avatar, styles[tone], square && styles.square, className)}
      style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.39)) }}
      aria-hidden={image ? undefined : true}
    >
      {image ?? name.trim().charAt(0)}
    </span>
  );
}

export interface AvatarStackProps {
  names: readonly string[];
  /** Max avatars before "+N". */
  max?: number;
  size?: number;
  className?: string;
}

export function AvatarStack({ names, max = 3, size = 28, className }: AvatarStackProps) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span className={cx(styles.stack, className)} role="img" aria-label={`${names.length}곳`}>
      {shown.map((n, i) => (
        <Avatar key={`${n}-${i}`} name={n} size={size} className={styles.stackItem} />
      ))}
      {rest > 0 && (
        <span
          className={cx(styles.avatar, styles.neutral, styles.stackItem)}
          style={{ width: size, height: size, fontSize: 12 }}
          aria-hidden="true"
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
