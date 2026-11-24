'use client';
import { Avatar, Button, Icon, IconButton, Popover, SearchField } from '@house/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useState, type ReactNode } from 'react';
import { env } from '@/config/env';
import { findAdminNav } from '@/config/nav';
import { useAdminSession } from '@/lib/auth/session';
import { adminRoleLabel } from '@/lib/auth/types';
import { useAdminHeaderValue } from './AdminHeaderContext';
import styles from './AdminShell.module.css';

export interface AdminTopbarProps {
  /** Unread notification count for the bell badge. */
  notificationCount?: number;
  /** Opens the mobile navigation drawer. */
  onOpenMenu: () => void;
  /**
   * Replaces the built-in search pill (m-core passes its live global search). The node sizes and
   * hides itself responsively — it is rendered as a direct flex child of the topbar.
   */
  search?: ReactNode;
}

/** Topbar per AdminDashboard design: crumb + title · search · 사이트 보기 · bell · account. */
export function AdminTopbar({ notificationCount = 0, onOpenMenu, search }: AdminTopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const override = useAdminHeaderValue();
  const { admin, logout } = useAdminSession();
  const [q, setQ] = useState('');

  const nav = findAdminNav(pathname);
  const title = override?.title ?? nav?.child?.label ?? nav?.item.label ?? '관리자';
  const crumb =
    override?.crumb ??
    [nav?.group, nav?.child ? { label: nav.item.label, href: nav.item.href } : undefined].filter(
      (c): c is string | { label: string; href: string } => !!c,
    );

  return (
    <header className={styles.top}>
      <IconButton className={styles.menuBtn} label="메뉴 열기" variant="plain" onClick={onOpenMenu}>
        <Icon name="menu" size={22} />
      </IconButton>
      <div className={styles.titles}>
        {crumb.length > 0 && (
          <nav className={styles.crumb} aria-label="현재 위치">
            {crumb.map((c, i) => (
              <Fragment key={i}>
                {i > 0 && <i aria-hidden="true" />}
                {typeof c === 'string' ? <span>{c}</span> : <Link href={c.href}>{c.label}</Link>}
              </Fragment>
            ))}
          </nav>
        )}
        <h1 className={styles.title}>{title}</h1>
      </div>
      {search ?? (
        <SearchField
          className={styles.search}
          variant="pill"
          label="관리자 검색"
          placeholder="매물번호, 중개사, 회원 검색"
          value={q}
          onChange={setQ}
          onSubmit={(value) => {
            const term = value.trim();
            if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
          }}
        />
      )}
      <span className={styles.siteLink}>
        <Button
          variant="secondary"
          size="sm"
          href={env.siteUrl}
          target="_blank"
          iconLeft={<Icon name="external-link" size={16} />}
        >
          사이트 보기
        </Button>
      </span>
      <span className={styles.bell}>
        <IconButton
          label={notificationCount > 0 ? `알림 ${notificationCount}건` : '알림'}
          href="/notifications"
          linkAs={Link}
        >
          <Icon name="bell" size={20} />
        </IconButton>
        {notificationCount > 0 && (
          <span className={styles.bellDot} aria-hidden="true">
            {notificationCount > 99 ? '99+' : notificationCount}
          </span>
        )}
      </span>
      <span className={styles.sep} aria-hidden="true" />
      {admin && (
        <Popover
          placement="bottom-end"
          label="내 계정 메뉴"
          flush
          trigger={(p) => (
            <button
              type="button"
              className={styles.me}
              {...p}
              aria-label={`${admin.name} 계정 메뉴`}
            >
              <Avatar name={admin.name} size={36} />
              <span className={styles.meText}>
                <b>{admin.name}</b>
                <span>{adminRoleLabel(admin.role)}</span>
              </span>
              <Icon name="chevron-down" size={16} />
            </button>
          )}
        >
          {(close) => (
            <div className={styles.menu}>
              <p className={styles.menuHead}>
                <b>{admin.name}</b>
                {admin.email}
              </p>
              <Link href="/settings/account" onClick={close}>
                <Icon name="shield" size={18} />
                계정 · 2단계 인증
              </Link>
              <button
                type="button"
                onClick={() => {
                  close();
                  void logout();
                }}
              >
                <Icon name="logout" size={18} />
                로그아웃
              </button>
            </div>
          )}
        </Popover>
      )}
    </header>
  );
}
