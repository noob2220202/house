"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_PATH_PREFIX = exports.SESSION_RESOLVER = void 0;
exports.resolveSessionOnce = resolveSessionOnce;
exports.normalizeRequestPath = normalizeRequestPath;
exports.isAdminPath = isAdminPath;
exports.SESSION_RESOLVER = Symbol('SESSION_RESOLVER');
const resolvedSessions = new WeakMap();
/**
 * Resolves the request's session at most once per request. The throttler guard (which keys limits
 * by user) and AuthGuard both need it; this keeps it to one Redis lookup / sliding-expiry touch.
 */
function resolveSessionOnce(req, resolver) {
    let pending = resolvedSessions.get(req);
    if (!pending) {
        pending = resolver.resolve(req);
        resolvedSessions.set(req, pending);
    }
    return pending;
}
/** Admin API lives under /api/v1/admin and authenticates with the admin cookie only. */
exports.ADMIN_PATH_PREFIX = '/api/v1/admin';
/**
 * Express routing is case-insensitive and tolerant of duplicate slashes in some setups, so the
 * check normalizes the same way: "/API/v1//Admin/auth/login" is an admin path too. Anything that
 * keys security decisions on the admin prefix (IP allowlist, admin cookie, audit) relies on this.
 */
function normalizeRequestPath(req) {
    const raw = (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '';
    let path = raw;
    try {
        path = decodeURIComponent(raw);
    }
    catch {
        // Malformed escapes: match on the raw form (routing will 400/404 it anyway).
    }
    return path.replace(/\/+/g, '/').toLowerCase();
}
function isAdminPath(req) {
    const path = normalizeRequestPath(req);
    return path === exports.ADMIN_PATH_PREFIX || path.startsWith(`${exports.ADMIN_PATH_PREFIX}/`);
}
//# sourceMappingURL=session-resolver.js.map