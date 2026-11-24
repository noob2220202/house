/**
 * Edge-safe auth path helpers (no @house/shared import → keeps the middleware bundle tiny).
 * Cookie names mirror COOKIE_NAMES in @house/shared — asserted by routes.test.ts.
 */
export const SESSION_COOKIE = 'house_sid';

/** Paths that require a signed-in user (middleware redirects to /login when the session cookie is absent). */
export const PROTECTED_PREFIXES = ['/me', '/agent', '/deal/sell', '/deal/find'] as const;
/** /agent pages reachable by any signed-in user (agency application); all other /agent pages need an agent role. */
export const AGENT_OPEN_PATHS = ['/agent/apply'] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) < 0x20) return true;
  }
  return false;
}

/**
 * Only site-relative paths are valid redirect targets (prevents open redirects):
 * must start with a single "/" and contain no backslash or control characters.
 */
export function safeReturnTo(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback;
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    hasControlChar(value)
  )
    return fallback;
  if (value.length > 500) return fallback;
  return value;
}

/** Login page URL that returns to `returnTo` afterwards. */
export function loginUrl(returnTo?: string): string {
  const target = safeReturnTo(returnTo, '');
  return target && target !== '/' ? `/login?returnTo=${encodeURIComponent(target)}` : '/login';
}

/** Signup completion URL (required terms consent) that continues to `returnTo` afterwards. */
export function signupUrl(returnTo?: string): string {
  const target = safeReturnTo(returnTo, '');
  return target && target !== '/' ? `/signup?returnTo=${encodeURIComponent(target)}` : '/signup';
}
