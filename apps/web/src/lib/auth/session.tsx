'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { isAgent, sessionUserSchema, type SessionUser } from './types';

export const SESSION_QUERY_KEY = ['auth', 'me'] as const;

export interface SessionState {
  /** Current user, or null when signed out. `undefined` while the first check is in flight. */
  user: SessionUser | null | undefined;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  isAgent: boolean;
  /** Re-fetch /auth/me (after login redirect, profile edit…). */
  refresh: () => Promise<void>;
  /** POST /auth/logout, clear the cache, then hard-navigate home. */
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

/** GET /auth/me → user, or null on 401. The httpOnly session cookie is never read in JS. */
export async function fetchSessionUser(): Promise<SessionUser | null> {
  try {
    return await api.get('/auth/me', { schema: sessionUserSchema });
  } catch (error) {
    if (error instanceof ApiError && (error.isUnauthenticated || error.isNotFound)) return null;
    throw error;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSessionUser,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const logoutMutation = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSettled: () => {
      queryClient.clear();
      window.location.assign('/');
    },
  });
  const { mutateAsync: logoutAsync } = logoutMutation;
  const { refetch, data, isPending, isError } = query;

  const value = useMemo<SessionState>(() => {
    const user = isPending ? undefined : isError ? null : (data ?? null);
    return {
      user,
      status: user === undefined ? 'loading' : user ? 'authenticated' : 'unauthenticated',
      isAgent: isAgent(user),
      refresh: async () => {
        await refetch();
      },
      logout: async () => {
        await logoutAsync().catch(() => undefined);
      },
    };
  }, [data, isPending, isError, refetch, logoutAsync]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Current session. Client components only. */
export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
