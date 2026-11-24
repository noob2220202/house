'use client';
import type { AuthProvider } from '@house/shared';
import { Spinner } from '@house/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SESSION_QUERY_KEY } from '@/lib/auth/session';
import { clearLoginContext } from '../../lib/login-context';
import { writeRecentProvider } from '../../lib/recent-provider';
import styles from './callback.module.css';

export interface CallbackLandingProps {
  /** Validated site-relative destination (decided on the server from the session). */
  target: string;
  provider?: AuthProvider;
}

/**
 * Success branch of the OAuth landing: remembers the provider for the "최근 사용" hint, refreshes
 * the cached session and moves on. Rendered only after the server confirmed the session.
 */
export function CallbackLanding({ target, provider }: CallbackLandingProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (provider) writeRecentProvider(provider);
    clearLoginContext();
    void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    router.replace(target);
  }, [provider, queryClient, router, target]);

  return (
    <div className={styles.wrap}>
      <div className={styles.card} role="status" aria-live="polite">
        <span className={`${styles.icon} ${styles.iconBrand}`}>
          <Spinner size={28} />
        </span>
        <h1 className={styles.title}>로그인하고 있어요</h1>
        <p className={styles.desc}>잠시만 기다려 주세요. 곧 원래 보던 화면으로 이동해요.</p>
        <p className={styles.help}>
          화면이 바뀌지 않으면{' '}
          <a className="link" href={target}>
            여기를 눌러 주세요
          </a>
        </p>
      </div>
    </div>
  );
}
