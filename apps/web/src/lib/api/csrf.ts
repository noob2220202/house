import { COOKIE_NAMES, HEADER_NAMES } from '@house/shared';
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

let pending: Promise<string | null> | null = null;

/**
 * Double-submit CSRF token: the backend sets the readable `house_csrf` cookie; mutations echo it in
 * the `x-csrf-token` header. When the cookie is missing, GET /auth/csrf (re)issues it.
 */
export async function getCsrfToken(forceRefresh = false): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  if (!forceRefresh) {
    const existing = readCookie(COOKIE_NAMES.CSRF);
    if (existing) return existing;
  }
  pending ??= fetch(apiUrl('/auth/csrf'), {
    credentials: 'include',
    headers: { accept: 'application/json' },
  })
    .then(async (res) => {
      const fromCookie = readCookie(COOKIE_NAMES.CSRF);
      if (fromCookie) return fromCookie;
      // Fallback: some deployments return the token in the body.
      const body: unknown = await res.json().catch(() => null);
      const token = (body as { csrfToken?: unknown } | null)?.csrfToken;
      return typeof token === 'string' ? token : null;
    })
    .catch(() => null)
    .finally(() => {
      pending = null;
    });
  return pending;
}
