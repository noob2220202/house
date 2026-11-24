import { parseIntent, safeNext, type LoginIntent } from './flow';

const KEY = 'house:auth:login-context';

/**
 * What the visitor chose on /login (member type, destination), kept for this tab while the OAuth
 * round trip runs. A first-time member comes back on /signup?provider= without any of it (the
 * backend keeps our `returnTo` with the pending signup and only answers it after POST /auth/signup),
 * so the signup screen reads the member type from here to show the 중개사 next step up front.
 * A hint only: the `returnTo` answered by the signup wins.
 */
export interface LoginContext {
  intent: LoginIntent;
  /** Validated site-relative destination ('' = home). */
  next: string;
}

export function rememberLoginContext(context: LoginContext): void {
  try {
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({ intent: context.intent, next: safeNext(context.next, '') }),
    );
  } catch {
    /* storage unavailable (private mode) — the hint is optional */
  }
}

/** Raw stored value (a stable snapshot for `useSyncExternalStore`). */
export function loginContextSnapshot(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Parses a stored value; anything malformed reads as "no context". */
export function parseLoginContext(raw: string | null): LoginContext | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { intent?: unknown; next?: unknown };
    const next = safeNext(typeof value.next === 'string' ? value.next : '', '');
    return { intent: parseIntent(typeof value.intent === 'string' ? value.intent : null), next };
  } catch {
    return null;
  }
}

export function readLoginContext(): LoginContext | null {
  return parseLoginContext(loginContextSnapshot());
}

export function clearLoginContext(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
