export const API_PREFIX = 'api/v1';

export const COOKIE_NAMES = {
  /** User-site session (opaque token). */
  SESSION: 'house_sid',
  /** Admin session, separate cookie and shorter lifetime. */
  ADMIN_SESSION: 'house_admin_sid',
  /** Double-submit CSRF token readable by JS. */
  CSRF: 'house_csrf',
} as const;

export const HEADER_NAMES = {
  CSRF: 'x-csrf-token',
  REQUEST_ID: 'x-request-id',
} as const;
