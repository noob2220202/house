'use client';
import { Drawer } from '@house/ui';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import type { AdminBadgeCounts } from '@/config/nav';
import { AdminHeaderProvider } from './AdminHeaderContext';
import styles from './AdminShell.module.css';
import { AdminNavList } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';

export interface AdminShellProps {
  children: ReactNode;
  /** Sidebar badge counts (pending queues). */
  badges?: AdminBadgeCounts;
  /** Bell badge. */
  notificationCount?: number;
  /** Node pinned to the bottom of the sidebar (e.g. <SidebarStatusCard …/>). */
  sidebarFooter?: ReactNode;
  /** Replaces the topbar's built-in search pill (see `AdminTopbarProps.search`). */
  topbarSearch?: ReactNode;
}

/**
 * Back-office shell per AdminDashboard design: ink sidebar (groups, badges, sub-menu) + topbar
 * (crumb, title, search, 사이트 보기, bell, account) + body. Sidebar becomes a drawer ≤ 720px.
 */
export function AdminShell({
  children,
  badges,
  notificationCount,
  sidebarFooter,
  topbarSearch,
}: AdminShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setMenuOpen(false), [pathname]);
  return (
    <AdminHeaderProvider>
      <div className={styles.adm}>
        <a href="#main" className={styles.skip}>
          본문 바로가기
        </a>
        <aside className={styles.side} aria-label="관리자 메뉴">
          <AdminNavList badges={badges} />
          {sidebarFooter && <div className={styles.sideFoot}>{sidebarFooter}</div>}
        </aside>
        <div className={styles.main}>
          <AdminTopbar
            notificationCount={notificationCount}
            onOpenMenu={() => setMenuOpen(true)}
            search={topbarSearch}
          />
          <main id="main" className={styles.body} tabIndex={-1}>
            {children}
          </main>
        </div>
        <Drawer
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          side="left"
          title="관리자 메뉴"
          width={280}
          ink
          flush
        >
          <div className={styles.drawerNav}>
            <AdminNavList badges={badges} onNavigate={() => setMenuOpen(false)} />
          </div>
        </Drawer>
      </div>
    </AdminHeaderProvider>
  );
}
