'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { sessionExpiredUrl } from '../../lib/session';
import styles from './ConsoleShell.module.css';

/**
 * Rendered by the console layout instead of the shell when the admin cookie is still there but the
 * API no longer accepts the session (idle timeout — the cookie lives until the absolute expiry —,
 * revoked session, TOTP reset). A server layout does not know the requested path, so the hop to
 * `/login?returnTo=<this page>&reason=expired` happens here, where the URL is known: the admin
 * comes back to the deep link they opened instead of the dashboard.
 */
export function SessionRedirect() {
  useEffect(() => {
    window.location.replace(
      sessionExpiredUrl(`${window.location.pathname}${window.location.search}`),
    );
  }, []);
  return (
    <main className={styles.redirect}>
      <p role="status">세션이 만료되어 로그인 화면으로 이동하고 있어요…</p>
      <Link href="/login?reason=expired">바로 이동</Link>
    </main>
  );
}
