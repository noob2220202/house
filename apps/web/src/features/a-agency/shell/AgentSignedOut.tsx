'use client';
import { Button, EmptyState } from '@house/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';
import { loginUrl } from '@/lib/auth/paths';
import styles from './AgentShell.module.css';

/**
 * Console chrome when the session cookie exists but the session is gone (expired / revoked).
 * Every console page redirects on the server with its own `returnTo` before this is ever shown;
 * this only covers a page without a guard — its content stays hidden behind a sign-in prompt that
 * returns to the current path.
 */
export function AgentSignedOut({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className={`${styles.shell} ${styles.solo}`}>
      <div className={styles.main}>
        <header className={styles.top}>
          <div className={styles.soloBrand}>
            <Logo size={30} />
            <span className={styles.env}>중개사 콘솔</span>
          </div>
        </header>
        <main id="main" className={styles.body} tabIndex={-1}>
          <div className={styles.gate}>
            <div hidden>{children}</div>
            <EmptyState
              icon="lock"
              title="다시 로그인해 주세요"
              description="로그인이 만료되었어요. 로그인하면 보던 화면으로 돌아와요."
              action={
                <Button href={loginUrl(pathname)} linkAs={Link}>
                  로그인
                </Button>
              }
            />
          </div>
        </main>
      </div>
    </div>
  );
}
