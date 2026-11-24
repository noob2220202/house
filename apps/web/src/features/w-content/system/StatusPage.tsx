import { Icon, cx, type IconName } from '@house/ui';
import type { ReactNode } from 'react';
import styles from './status.module.css';

export interface StatusPageProps {
  /** Big numerals ("404", "500"). Decorative — the title carries the meaning. */
  code?: string;
  /** Icon tile instead of numerals (maintenance). */
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  /** Primary / secondary buttons. */
  actions?: ReactNode;
  /** Extra content under the actions (search, quick links, schedule). */
  children?: ReactNode;
  /** Small support line at the bottom (error code, contact). */
  footnote?: ReactNode;
  /** Fill the viewport (pages without the site chrome). */
  fullHeight?: boolean;
  /** Announce as an alert (error pages). */
  alert?: boolean;
}

/** Shared body of the 404 / 500 / maintenance pages: numerals or icon, title, help, actions. */
export function StatusPage({
  code,
  icon,
  title,
  description,
  actions,
  children,
  footnote,
  fullHeight,
  alert,
}: StatusPageProps) {
  return (
    <div className={cx(styles.wrap, fullHeight && styles.full)} role={alert ? 'alert' : undefined}>
      <div className={styles.inner}>
        {code && (
          <p className={styles.code} aria-hidden="true">
            {code}
          </p>
        )}
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            <Icon name={icon} size={32} />
          </span>
        )}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.desc}>{description}</p>}
        {actions && <div className={styles.actions}>{actions}</div>}
        {children}
        {footnote && <p className={styles.footnote}>{footnote}</p>}
      </div>
    </div>
  );
}

/** Minimal top bar (logo only) for pages rendered outside the site chrome. */
export function StatusHeader({ children }: { children: ReactNode }) {
  return <header className={styles.header}>{children}</header>;
}
