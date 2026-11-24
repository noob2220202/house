'use client';
import { Icon, cx } from '@house/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';
import { BRAND } from '@/config/brand';
import { ADMIN_NAV, isAdminPathActive, type AdminBadgeCounts } from '@/config/nav';
import { useAdminSession } from '@/lib/auth/session';
import styles from './AdminShell.module.css';

export interface AdminNavListProps {
  /** Counts for the nav badges (pending listings, open reports…). Zero/undefined hides the badge. */
  badges?: AdminBadgeCounts;
  /** Called after a link is activated (closes the mobile drawer). */
  onNavigate?: () => void;
}

/** Logo row + permission-aware nav groups. Shared by the desktop sidebar and the mobile drawer. */
export function AdminNavList({ badges, onNavigate }: AdminNavListProps) {
  const pathname = usePathname();
  const { can } = useAdminSession();
  return (
    <>
      <div className={styles.brandRow}>
        <Logo tone="ink" size={30} />
        <span className={styles.env}>{BRAND.consoleLabel}</span>
      </div>
      {ADMIN_NAV.map((group, gi) => {
        const items = group.items.filter((item) => can(item.minRole));
        if (items.length === 0) return null;
        const headingId = group.title ? `adm-nav-${gi}` : undefined;
        return (
          <nav
            key={group.title ?? 'home'}
            className={styles.group}
            aria-labelledby={headingId}
            aria-label={headingId ? undefined : '홈'}
          >
            {group.title && (
              <p className={styles.groupTitle} id={headingId}>
                {group.title}
              </p>
            )}
            {items.map((item) => {
              const children = (item.children ?? []).filter((c) => can(c.minRole));
              const childActive = children.some((c) => isAdminPathActive(pathname, c.href));
              const on = isAdminPathActive(pathname, item.href, item.match) || childActive;
              const count = item.badgeKey ? badges?.[item.badgeKey] : undefined;
              return (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    className={cx(styles.item, on && styles.on)}
                    aria-current={on && !childActive ? 'page' : undefined}
                    onClick={onNavigate}
                  >
                    <Icon name={item.icon} size={20} />
                    {item.label}
                    {!!count && (
                      <span
                        className={cx(styles.badge, item.badgeWarn && styles.badgeWarn)}
                        aria-label={`${count}건 대기`}
                      >
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </Link>
                  {children.length > 0 && (
                    <div className={styles.sub}>
                      {children.map((c) => {
                        const cOn = isAdminPathActive(pathname, c.href);
                        return (
                          <Link
                            key={c.href}
                            href={c.href}
                            className={cx(styles.subItem, cOn && styles.on)}
                            aria-current={cOn ? 'page' : undefined}
                            onClick={onNavigate}
                          >
                            {c.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        );
      })}
    </>
  );
}

export interface SidebarStatusCardProps {
  title: string;
  /** Short status word: 정상 / 점검 필요. */
  status: string;
  tone?: 'ok' | 'warn';
  children?: ReactNode;
}

/** Status card pinned to the bottom of the sidebar (e.g. 간편 로그인 연동 · 정상). Pass via `sidebarFooter`. */
export function SidebarStatusCard({
  title,
  status,
  tone = 'ok',
  children,
}: SidebarStatusCardProps) {
  return (
    <div className={styles.statusCard}>
      <p className={styles.statusHead}>
        {title}
        <b className={tone === 'ok' ? styles.statusOk : styles.statusWarn}>{status}</b>
      </p>
      {children}
    </div>
  );
}
