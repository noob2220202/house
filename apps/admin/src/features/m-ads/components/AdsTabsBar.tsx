'use client';
import { Tabs } from '@house/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ADMIN_ROUTES } from '@/config/nav';
import styles from './ads.module.css';

export interface AdsTabsBarProps {
  current: 'banners' | 'popups';
  bannerCount?: number;
  popupCount?: number;
  /** Right side buttons (슬롯 규격표, 새 배너 등록 …). */
  actions?: ReactNode;
}

/** 배너 N │ 팝업 N navigation tabs with the page actions on the right (design `.ab-bar`). */
export function AdsTabsBar({ current, bannerCount, popupCount, actions }: AdsTabsBarProps) {
  return (
    <div className={styles.bar}>
      <Tabs
        label="관리 대상"
        className={styles.tabs}
        value={current}
        linkAs={Link}
        items={[
          { value: 'banners', label: '배너', count: bannerCount, href: ADMIN_ROUTES.banners },
          { value: 'popups', label: '팝업', count: popupCount, href: ADMIN_ROUTES.popups },
        ]}
      />
      {actions && <div className={styles.barActions}>{actions}</div>}
    </div>
  );
}
