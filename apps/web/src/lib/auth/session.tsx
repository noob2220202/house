'use client';
import { AuthErrorCode, COOKIE_NAMES } from '@house/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { ReconsentDialog } from '@/features/w-auth/components/reconsent/ReconsentDialog';
import { api } from '@/lib/api/client';
import { readCookie } from '@/lib/api/csrf';
import { ApiError } from '@/lib/api/errors';
import { isAgent, needsReconsent, sessionUserSchema, type SessionUser } from './types';

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
  /** Opens the 약관 재동의 prompt (when required terms are pending). */
  requestReconsent: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

/**
 * GET /auth/me → user, or null when signed out. The httpOnly session cookie is never read in JS,
 * but the backend always sets the readable `house_csrf` cookie together with it (same lifetime,
 * cleared together on logout): without that cookie there is no session, so anonymous visitors are
 * answered locally instead of with a 401 the browser would log on every page. A 401 / 404 is
 * "signed out" too, never an error.
 */
export async function fetchSessionUser(): Promise<SessionUser | null> {
  if (typeof document !== 'undefined' && !readCookie(COOKIE_NAMES.CSRF)) return null;
  try {
    return await api.get('/auth/me', { schema: sessionUserSchema });
  } catch (error) {
    if (error instanceof ApiError && (error.isUnauthenticated || error.isNotFound)) return null;
    throw error;
  }
}

/** Pages where the re-consent prompt never opens by itself (auth flow, reading terms, withdrawal). */
const QUIET_PREFIXES = ['/login', '/signup', '/auth', '/terms', '/me/withdraw'] as const;
const DISMISS_KEY = 'house:auth:reconsent-dismissed';
const subscribeNever = () => () => undefined;

/** Marks the re-consent dialog in the DOM (see `otherModalOpen`). */
export const RECONSENT_DIALOG_CLASS = 'house-reconsent';

/**
 * Another modal dialog (a notice popup, a confirmation) is on screen: the prompt that opens by
 * itself waits for it, so two focus traps never fight over the page.
 */
function subscribeModals(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
function otherModalOpen(): boolean {
  return document.querySelector(`[aria-modal="true"]:not(.${RECONSENT_DIALOG_CLASS})`) !== null;
}

function dismissedFor(types: readonly string[]): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === types.join(',');
  } catch {
    return false;
  }
}

function rememberDismissal(types: readonly string[]): void {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, types.join(','));
  } catch {
    /* storage unavailable — the prompt simply opens again on the next page */
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const pathname = usePathname() ?? '';
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

  // ---- 약관 재동의 (pendingRequiredTerms / 403 AUTH_TERMS_REQUIRED) ----
  const [reconsentOpen, setReconsentOpen] = useState(false);
  /** Set of pending documents dismissed in this render tree (sessionStorage keeps it per tab). */
  const [dismissed, setDismissed] = useState<string | null>(null);
  const pending = useMemo(() => data?.pendingRequiredTerms ?? [], [data]);
  const quiet = QUIET_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  // sessionStorage is read after hydration only (server snapshot = not hydrated).
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const blockedByModal = useSyncExternalStore(subscribeModals, otherModalOpen, () => true);
  // Opens by itself once per tab and set of pending documents ("나중에 할게요" is remembered).
  const autoOpen =
    hydrated &&
    !blockedByModal &&
    pending.length > 0 &&
    !quiet &&
    dismissed !== pending.join(',') &&
    !dismissedFor(pending);

  // Any mutation the backend refused for missing consent opens the prompt — wherever it ran.
  useEffect(
    () =>
      queryClient.getMutationCache().subscribe((event) => {
        if (event.type !== 'updated' || event.action.type !== 'error') return;
        const error: unknown = event.action.error;
        if (!(error instanceof ApiError) || error.code !== AuthErrorCode.AUTH_TERMS_REQUIRED)
          return;
        void refetch();
        setReconsentOpen(true);
      }),
    [queryClient, refetch],
  );

  const requestReconsent = useCallback(() => setReconsentOpen(true), []);

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
      requestReconsent,
    };
  }, [data, isPending, isError, refetch, logoutAsync, requestReconsent]);

  return (
    <SessionContext.Provider value={value}>
      {children}
      {needsReconsent(data) && (
        <ReconsentDialog
          className={RECONSENT_DIALOG_CLASS}
          open={reconsentOpen || autoOpen}
          pendingTypes={pending}
          onClose={() => {
            rememberDismissal(pending);
            setDismissed(pending.join(','));
            setReconsentOpen(false);
          }}
          onAgreed={async () => {
            setReconsentOpen(false);
            await refetch();
          }}
        />
      )}
    </SessionContext.Provider>
  );
}

/** Current session. Client components only. */
export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
