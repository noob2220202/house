import type { ReactNode } from 'react';
import type { SessionUser } from '@/lib/auth/types';
import { MeSideNav } from './MeSideNav';
import styles from './MeShell.module.css';

export interface MeShellProps {
  user: SessionUser;
  children: ReactNode;
}

/**
 * My-page frame: sticky side navigation on desktop, content column on the right.
 * On mobile (≤ 720px) the side navigation is hidden — the MY home page is the menu and every sub
 * page draws its own top bar through <MePage>.
 */
export function MeShell({ user, children }: MeShellProps) {
  return (
    <div className={styles.shell}>
      <aside className={styles.side} aria-label="마이페이지 메뉴">
        <MeSideNav user={user} />
      </aside>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
