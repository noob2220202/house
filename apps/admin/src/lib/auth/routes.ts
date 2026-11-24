/** Edge-safe (no @house/shared import). Mirrors COOKIE_NAMES.ADMIN_SESSION — asserted by routes.test.ts. */
export const ADMIN_SESSION_COOKIE = 'house_admin_sid';

/** Paths reachable without an admin session. Everything else requires one. */
export const PUBLIC_PATHS = ['/login', '/healthz'] as const;

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith('/mock-api/')
  );
}

/** Only site-relative paths are valid redirect targets (prevents open redirects). */
export function safeReturnTo(value: string | null | undefined, fallback = '/'): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    value.length > 500
  )
    return fallback;
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) < 0x20) return fallback;
  }
  return value;
}

export function loginUrl(returnTo?: string): string {
  const target = safeReturnTo(returnTo, '');
  return target && target !== '/' && !target.startsWith('/login')
    ? `/login?returnTo=${encodeURIComponent(target)}`
    : '/login';
}
