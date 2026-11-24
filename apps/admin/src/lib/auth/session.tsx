'use client';
import type { AdminRole } from '@house/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { adminUserSchema, hasAdminRole, type AdminUser } from './types';

export const ADMIN_SESSION_QUERY_KEY = ['admin', 'auth', 'me'] as const;

export interface AdminSessionState {
  /** Current admin, null when signed out, undefined while loading. */
  admin: AdminUser | null | undefined;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  /** Permission check: `can(AdminRole.ADMIN)` → that rank or higher. */
  can: (min?: AdminRole) => boolean;
  refresh: () => Promise<void>;
  /** POST /admin/auth/logout then hard-navigate to /login. */
  logout: () => Promise<void>;
}

const AdminSessionContext = createContext<AdminSessionState | null>(null);

/** GET /admin/auth/me → admin, or null on 401. The httpOnly admin session cookie is never read in JS. */
export async function fetchAdminUser(): Promise<AdminUser | null> {
  try {
    return await api.get('/admin/auth/me', { schema: adminUserSchema });
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.isUnauthenticated || error.isForbidden || error.isNotFound)
    )
      return null;
    throw error;
  }
}

export interface AdminSessionProviderProps {
  children: ReactNode;
  /** Admin resolved on the server by the console layout — avoids a loading flash. */
  initialAdmin?: AdminUser | null;
}

export function AdminSessionProvider({ children, initialAdmin }: AdminSessionProviderProps) {
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ADMIN_SESSION_QUERY_KEY,
    queryFn: fetchAdminUser,
    initialData: initialAdmin ?? undefined,
    staleTime: 60_000,
    retry: false,
  });
  const { mutateAsync: logoutAsync } = useMutation({
    mutationFn: () => api.post('/admin/auth/logout'),
    onSettled: () => {
      queryClient.clear();
      window.location.assign('/login');
    },
  });

  const value = useMemo<AdminSessionState>(() => {
    const admin = isPending ? undefined : isError ? null : (data ?? null);
    return {
      admin,
      status: admin === undefined ? 'loading' : admin ? 'authenticated' : 'unauthenticated',
      can: (min) => hasAdminRole(admin, min),
      refresh: async () => {
        await refetch();
      },
      logout: async () => {
        await logoutAsync().catch(() => undefined);
      },
    };
  }, [data, isPending, isError, refetch, logoutAsync]);

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

/** Current admin session. Client components only. */
export function useAdminSession(): AdminSessionState {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error('useAdminSession must be used inside <AdminSessionProvider>');
  return ctx;
}
