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

/*
 * The CSRF token of this tab's session, kept in memory (auth README, "Frontend notes").
 *
 * The backend also sets the readable `house_csrf` cookie, but the user site and the back office
 * share that cookie name: with both open in one browser the cookie can hold the OTHER app's token.
 * So the token comes from response bodies — `POST /auth/signup` (`SignupResponse.csrfToken`) and
 * `GET /auth/csrf` (`{ csrfToken }`, which answers the current session's token) — and the cookie is
 * only a last resort when GET /auth/csrf itself cannot be reached.
 */
let memoryToken: string | null = null;
/** Bumped by every remember/forget, so a refresh started earlier never overwrites a newer token. */
let generation = 0;
let pending: Promise<string | null> | null = null;

function tokenOf(body: unknown): string | null {
  const token = (body as { csrfToken?: unknown } | null)?.csrfToken;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

/**
 * Keeps the `csrfToken` of a response body (any endpoint that (re)creates a session answers it).
 * The API client calls this for every successful response; bodies without one are ignored.
 */
export function rememberCsrfToken(body: unknown): void {
  const token = tokenOf(body);
  if (!token || typeof window === 'undefined') return;
  memoryToken = token;
  generation += 1;
}

/** Drops the remembered token (logout, a 401 — the session it belonged to is gone). */
export function forgetCsrfToken(): void {
  memoryToken = null;
  generation += 1;
}

/**
 * Token for the `x-csrf-token` header of a mutation (double-submit, checked against the session):
 * the remembered one, else GET /auth/csrf. `forceRefresh` (after a `CSRF_FAILED`) always asks the
 * server again. Concurrent callers share one request. Server-side calls carry no CSRF header.
 */
export async function getCsrfToken(forceRefresh = false): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!forceRefresh && memoryToken) return memoryToken;
  if (forceRefresh && !pending) forgetCsrfToken();
  if (!pending) {
    const startedAt = generation;
    pending = fetch(apiUrl('/auth/csrf'), {
      credentials: 'include',
      headers: { accept: 'application/json' },
    })
      .then(async (res) => (res.ok ? tokenOf(await res.json().catch(() => null)) : null))
      .catch(() => null)
      .then((token) => {
        if (token) {
          // A signup that finished while this request was in flight wins.
          if (generation === startedAt) {
            memoryToken = token;
            generation += 1;
          }
          return memoryToken ?? token;
        }
        return memoryToken ?? readCookie(COOKIE_NAMES.CSRF);
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}
