import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';
import { cx } from '../lib/cx';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'li' | 'aside';
  /** Adds the default 24px padding. */
  padded?: boolean;
  /** Radius: `xl` 24 (site cards, default) or `lg` 16 (panels, admin). */
  radius?: 'xl' | 'lg';
  /** Dark premium surface. */
  ink?: boolean;
  /** Hover lift (for clickable cards). */
  interactive?: boolean;
}

/** Surface container: white, 1px line, 24px radius. */
export function Card({
  as: Tag = 'div',
  padded,
  radius = 'xl',
  ink,
  interactive,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cx(
        styles.card,
        padded && styles.pad,
        radius === 'lg' && styles.lg,
        ink && styles.ink,
        interactive && styles.interactive,
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  /** Brand-coloured count after the title. */
  count?: ReactNode;
  /** Caption after the title. */
  description?: ReactNode;
  /** Right side of the header (links, segmented control…). */
  actions?: ReactNode;
  /** Remove body padding (tables, lists). */
  flush?: boolean;
  footer?: ReactNode;
  as?: 'section' | 'div' | 'article';
}

/** Admin/console panel: 16px radius card with a header row (`.panel`). */
export function Panel({
  title,
  count,
  description,
  actions,
  flush,
  footer,
  as: Tag = 'section',
  className,
  children,
  ...rest
}: PanelProps) {
  return (
    <Tag className={cx(styles.panel, className)} {...rest}>
      {(title || actions) && (
        <header className={styles.panelHd}>
          <div className={styles.panelHdText}>
            {title && (
              <h2 className={styles.panelT}>
                {title}
                {count !== undefined && <span className={styles.panelCount}> {count}</span>}
              </h2>
            )}
            {description && <p className={styles.panelDesc}>{description}</p>}
          </div>
          {actions && <div className={styles.panelActions}>{actions}</div>}
        </header>
      )}
      <div className={flush ? undefined : styles.panelBd}>{children}</div>
      {footer && <footer className={styles.panelFt}>{footer}</footer>}
    </Tag>
  );
}
