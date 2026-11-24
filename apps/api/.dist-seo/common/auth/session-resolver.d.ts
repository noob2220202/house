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
export declare const SESSION_RESOLVER: unique symbol;
/**
 * Resolves the request's session at most once per request. The throttler guard (which keys limits
 * by user) and AuthGuard both need it; this keeps it to one Redis lookup / sliding-expiry touch.
 */
export declare function resolveSessionOnce(req: Request, resolver: SessionResolver): Promise<ResolvedSession | null>;
/** Admin API lives under /api/v1/admin and authenticates with the admin cookie only. */
export declare const ADMIN_PATH_PREFIX = "/api/v1/admin";
/**
 * Express routing is case-insensitive and tolerant of duplicate slashes in some setups, so the
 * check normalizes the same way: "/API/v1//Admin/auth/login" is an admin path too. Anything that
 * keys security decisions on the admin prefix (IP allowlist, admin cookie, audit) relies on this.
 */
export declare function normalizeRequestPath(req: Request): string;
export declare function isAdminPath(req: Request): boolean;
