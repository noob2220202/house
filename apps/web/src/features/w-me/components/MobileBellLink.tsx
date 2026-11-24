'use client';
import { Icon } from '@house/ui';
import Link from 'next/link';
import { useUnreadNotificationCount } from '../api';
import { ME_ROUTES } from '../routes';
import styles from './MePage.module.css';

/** Bell in the mobile top bar with the unread dot. */
export function MobileBellLink() {
  const unread = (useUnreadNotificationCount().data ?? 0) > 0;
  return (
    <Link
      href={ME_ROUTES.notifications}
      className={styles.topBtn}
      aria-label={unread ? '알림, 새 알림 있음' : '알림'}
    >
      <Icon name="bell" size={24} />
      {unread && <span className={styles.topDot} aria-hidden="true" />}
    </Link>
  );
}

/** Top-bar actions of the MY home: 알림 + 내 정보 설정. */
export function MobileOverviewActions() {
  return (
    <>
      <MobileBellLink />
      <Link href={ME_ROUTES.profile} className={styles.topBtn} aria-label="내 정보 설정">
        <Icon name="settings" size={24} />
      </Link>
    </>
  );
}
