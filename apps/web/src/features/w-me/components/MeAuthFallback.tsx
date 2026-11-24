'use client';
import { useEffect } from 'react';
import { loginUrl, useSession } from '@/lib/auth';

/**
 * Safety net for pages of the /me group that forgot their server guard: once the client session
 * check says "signed out", leave for the login page and come back to the current URL afterwards.
 */
export function MeAuthFallback() {
  const { status } = useSession();
  useEffect(() => {
    if (status !== 'unauthenticated') return;
    const here = `${window.location.pathname}${window.location.search}`;
    window.location.replace(loginUrl(here));
  }, [status]);
  return null;
}
