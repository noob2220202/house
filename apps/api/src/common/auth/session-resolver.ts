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

/** Admin API lives under /api/v1/admin and authenticates with the admin cookie only. */
export const ADMIN_PATH_PREFIX = '/api/v1/admin';

export function isAdminPath(req: Request): boolean {
  const path = req.originalUrl.split('?')[0] ?? '';
  return path === ADMIN_PATH_PREFIX || path.startsWith(`${ADMIN_PATH_PREFIX}/`);
}
