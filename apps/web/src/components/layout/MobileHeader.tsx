import { Icon, cx } from '@house/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ROUTES } from '@/config/nav';
import { Logo } from '@/components/brand/Logo';
import styles from './SiteHeader.module.css';

export interface MobileHeaderProps {
  /** Page title instead of the logo (sub pages). */
  title?: string;
  /** Back link target shown before the title. */
  backHref?: string;
  /** Replace the default actions (검색, 알림). */
  actions?: ReactNode;
  /** Bottom border (use on pages without a hero directly under the header). */
  bordered?: boolean;
  /** Show the unread-notification dot. */
  hasUnread?: boolean;
}

/** Mobile top bar (≤ 720px) per MobileHome: logo + 검색 + 알림. Sticky, translucent. */
export function MobileHeader({ title, backHref, actions, bordered, hasUnread }: MobileHeaderProps) {
  return (
    <header className={cx(styles.mobile, bordered && styles.bordered)}>
      {backHref && (
        <Link href={backHref} className={cx(styles.mobileBtn, styles.mobileBack)} aria-label="뒤로">
          <Icon name="chevron-left" size={24} />
        </Link>
      )}
      {title ? <h1 className={styles.mobileTitle}>{title}</h1> : <Logo size={28} />}
      <div className={styles.mobileAct}>
        {actions ?? (
          <>
            <Link href="/search" className={styles.mobileBtn} aria-label="검색">
              <Icon name="search" size={24} />
            </Link>
            <Link
              href={ROUTES.notifications}
              className={styles.mobileBtn}
              aria-label={hasUnread ? '알림, 새 알림 있음' : '알림'}
            >
              <Icon name="bell" size={24} />
              {hasUnread && <span className={styles.dot} aria-hidden="true" />}
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
