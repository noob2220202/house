import { cx } from '@house/ui';
import type { ReactNode } from 'react';
import styles from './ConsolePage.module.css';

export interface ConsolePageProps {
  children: ReactNode;
  /** `wide` (1320, dashboards/tables) or `narrow` (1120, forms). */
  width?: 'wide' | 'narrow';
  className?: string;
}

/** Page container of the broker console body: centred column with the standard vertical rhythm. */
export function ConsolePage({ children, width = 'wide', className }: ConsolePageProps) {
  return <div className={cx(styles.page, styles[width], className)}>{children}</div>;
}

export interface ConsolePageHeaderProps {
  /** Page title (the route's h1). */
  title: ReactNode;
  /** Small brand-coloured line above the title. */
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Right-aligned actions (full-width row on mobile). */
  actions?: ReactNode;
}

/** Title block of a console page: eyebrow · h1 · description + actions. */
export function ConsolePageHeader({
  title,
  eyebrow,
  description,
  actions,
}: ConsolePageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerText}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.desc}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
