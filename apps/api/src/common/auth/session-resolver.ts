import type { Request } from 'express';
import type { Principal } from './principal';

export interface ResolvedSession {
  principal: Principal;
  /** Synchronizer CSRF token bound to the session (also exposed in the house_csrf cookie). */
  csrfToken: string;
}

/**
 * Implemented by the auth module's SessionService and bound to SESSION_RESOLVER.
 * Guards only depend on this interface.
 */
export interface SessionResolver {
  resolve(req: Request): Promise<ResolvedSession | null>;
}

export const SESSION_RESOLVER = Symbol('SESSION_RESOLVER');

const resolvedSessions = new WeakMap<Request, Promise<ResolvedSession | null>>();

/**
 * Resolves the request's session at most once per request. The throttler guard (which keys limits
 * by user) and AuthGuard both need it; this keeps it to one Redis lookup / sliding-expiry touch.
 */
export function resolveSessionOnce(
  req: Request,
  resolver: SessionResolver,
): Promise<ResolvedSession | null> {
  let pending = resolvedSessions.get(req);
  if (!pending) {
    pending = resolver.resolve(req);
    resolvedSessions.set(req, pending);
  }
  return pending;
}

/** Admin API lives under /api/v1/admin and authenticates with the admin cookie only. */
export const ADMIN_PATH_PREFIX = '/api/v1/admin';

/**
 * Express routing is case-insensitive and tolerant of duplicate slashes in some setups, so the
 * check normalizes the same way: "/API/v1//Admin/auth/login" is an admin path too. Anything that
 * keys security decisions on the admin prefix (IP allowlist, admin cookie, audit) relies on this.
 */
export function normalizeRequestPath(req: Request): string {
  const raw = (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '';
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {
    // Malformed escapes: match on the raw form (routing will 400/404 it anyway).
  }
  return path.replace(/\/+/g, '/').toLowerCase();
}

export function isAdminPath(req: Request): boolean {
  const path = normalizeRequestPath(req);
  return path === ADMIN_PATH_PREFIX || path.startsWith(`${ADMIN_PATH_PREFIX}/`);
}
