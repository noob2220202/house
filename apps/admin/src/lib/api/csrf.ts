import { HEADER_NAMES } from '@house/shared';
import { apiUrl } from './config';

export const CSRF_HEADER = HEADER_NAMES.CSRF;

/** Reads a (non-httpOnly) cookie in the browser. The session cookie is httpOnly and is never read in JS. */
export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
  }
  return null;
}

/**
 * The CSRF token of the current admin session, kept in memory. The backend binds the token to the
 * session and rotates both on login / TOTP activate / verify / password change; those responses
 * carry the new token in their body (`csrfToken`) and the caller stores it with `rememberCsrfToken`.
 *
 * The readable `house_csrf` cookie is deliberately NOT used: user and admin sessions share that
 * cookie name, so on a shared cookie domain it may hold the user site's token.
 */
let current: string | null = null;
let pending: Promise<string | null> | null = null;

/** Stores the token returned by a response that (re)created the admin session. */
export function rememberCsrfToken(token: string | null | undefined): void {
  current = typeof token === 'string' && token ? token : null;
}

/** Drops the token (logout, or before re-reading it after a CSRF failure). */
export function forgetCsrfToken(): void {
  current = null;
}

/**
 * Token for the `x-csrf-token` header of a mutation. Without a remembered token (page reload),
 * GET /admin/auth/csrf returns the token bound to the admin session cookie; it answers 401 when
 * there is no admin session yet, which is fine: requests without a session (the login itself) are
 * not CSRF-checked.
 */
export async function getCsrfToken(forceRefresh = false): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  if (forceRefresh) current = null;
  if (current) return current;
  pending ??= fetch(apiUrl('/admin/auth/csrf'), {
    credentials: 'include',
    headers: { accept: 'application/json' },
    cache: 'no-store',
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const body: unknown = await res.json().catch(() => null);
      const token = (body as { csrfToken?: unknown } | null)?.csrfToken;
      if (typeof token !== 'string' || !token) return null;
      current = token;
      return token;
    })
    .catch(() => null)
    .finally(() => {
      pending = null;
    });
  return pending;
}
