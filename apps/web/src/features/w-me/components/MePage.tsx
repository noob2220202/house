import { cx } from '@house/ui';
import type { ReactNode } from 'react';
import { MobileHeader } from '@/components/layout';
import styles from './MePage.module.css';

export interface MePageProps {
  /** Page title: desktop heading and mobile top-bar title. */
  title: string;
  /** Shorter title for the mobile top bar (defaults to `title`). */
  mobileTitle?: string;
  description?: ReactNode;
  /** Mobile back target. Omit on tab-bar roots (MY, 관심). */
  backHref?: string;
  /** Right side of the desktop heading row. */
  actions?: ReactNode;
  /** Actions of the mobile top bar (defaults to none). */
  mobileActions?: ReactNode;
  /** Hide the desktop heading (pages that draw their own, e.g. the overview greeting). */
  hideHeading?: boolean;
  /** Narrow reading column for forms. */
  narrow?: boolean;
  children: ReactNode;
}

/**
 * Frame of one /me page: the mobile top bar (title + back, like the MobileListing sub pages) and
 * the desktop heading row, then the page body with the group's paddings.
 */
export function MePage({
  title,
  mobileTitle,
  description,
  backHref,
  actions,
  mobileActions,
  hideHeading,
  narrow,
  children,
}: MePageProps) {
  return (
    <>
      <MobileHeader
        title={mobileTitle ?? title}
        backHref={backHref}
        actions={mobileActions ?? <span />}
        bordered
      />
      <div className={cx(styles.body, narrow && styles.narrow)}>
        {!hideHeading && (
          <header className={styles.head}>
            <div className={styles.headText}>
              <h1 className={cx('t-h2', styles.title)}>{title}</h1>
              {description && <p className={cx('t-sm', styles.desc)}>{description}</p>}
            </div>
            {actions && <div className={styles.actions}>{actions}</div>}
          </header>
        )}
        {children}
      </div>
    </>
  );
}
