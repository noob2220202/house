'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { isSessionLost, sessionExpiredUrl } from '../../lib/session';

/**
 * Session handling for the console: when any query or mutation fails because the admin session is
 * gone (short admin sessions, logout in another tab, revoked account), leave for the login page and
 * come back to the same screen afterwards.
 */
export function SessionWatcher() {
  const queryClient = useQueryClient();
  const leaving = useRef(false);
  useEffect(() => {
    const leave = (error: unknown) => {
      if (leaving.current || !isSessionLost(error)) return;
      leaving.current = true;
      queryClient.cancelQueries().catch(() => undefined);
      window.location.assign(
        sessionExpiredUrl(`${window.location.pathname}${window.location.search}`),
      );
    };
    const offQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error') leave(event.action.error);
    });
    const offMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error') leave(event.action.error);
    });
    return () => {
      offQueries();
      offMutations();
    };
  }, [queryClient]);
  return null;
}
