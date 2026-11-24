'use client';
import { useCallback, useEffect, useRef } from 'react';
import { loginUrl } from './routes';
import { useSession } from './session';

/** Query param that carries an action to resume after login (`?intent=favorite`). */
export const INTENT_PARAM = 'intent';
/** Which entity the intent is for (`?intent=favorite&target=listings:<id>`). */
export const INTENT_TARGET_PARAM = 'target';

/**
 * Site-relative URL of the current page with the intent params replaced (or removed when
 * `intent` is omitted) — the `returnTo` of the login page.
 */
export function intentPath(intent?: string, target?: string): string {
  const { pathname, search } = window.location;
  const sp = new URLSearchParams(search);
  sp.delete(INTENT_PARAM);
  sp.delete(INTENT_TARGET_PARAM);
  if (intent) sp.set(INTENT_PARAM, intent);
  if (intent && target) sp.set(INTENT_TARGET_PARAM, target);
  const q = sp.toString();
  return q ? `${pathname}?${q}` : pathname;
}

/** The intent in the current URL, if any. */
export function readIntent(): { intent: string; target: string | null } | null {
  const sp = new URLSearchParams(window.location.search);
  const intent = sp.get(INTENT_PARAM);
  return intent ? { intent, target: sp.get(INTENT_TARGET_PARAM) } : null;
}

/** Removes the intent params from the address bar (no navigation, history entry kept). */
export function clearIntent(): void {
  window.history.replaceState(window.history.state, '', intentPath());
}

/**
 * Auth gate for actions that need a session: runs `run` for signed-in users and sends everyone
 * else to /login, returning to this page with `?intent=<intent>[&target=…]` so the page can
 * resume the action. While the session is still loading the action is parked, not dropped.
 */
export function useAuthGate() {
  const { status } = useSession();
  const parked = useRef<{ intent?: string; target?: string; run: () => void } | null>(null);

  const gate = useCallback(
    (run: () => void, intent?: string, target?: string) => {
      if (status === 'authenticated') run();
      else if (status === 'unauthenticated')
        window.location.assign(loginUrl(intentPath(intent, target)));
      else parked.current = { intent, target, run };
    },
    [status],
  );

  useEffect(() => {
    const p = parked.current;
    if (!p || status === 'loading') return;
    parked.current = null;
    if (status === 'authenticated') p.run();
    else window.location.assign(loginUrl(intentPath(p.intent, p.target)));
  }, [status]);

  return { gate, status };
}
