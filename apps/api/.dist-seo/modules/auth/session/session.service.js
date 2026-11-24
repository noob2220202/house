"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionService = void 0;
exports.hashSessionToken = hashSessionToken;
exports.sessionCookieName = sessionCookieName;
exports.readSessionCookie = readSessionCookie;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const session_resolver_1 = require("../../../common/auth/session-resolver");
const app_config_service_1 = require("../../../config/app-config.service");
const redis_constants_1 = require("../../../redis/redis.constants");
const ip_allowlist_1 = require("../admin/ip-allowlist");
/** Don't rewrite the record on every request; refresh sliding expiry at most this often. */
const TOUCH_INTERVAL_MS = 60_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PATCH_RETRIES = 5;
/**
 * Compare-and-set rewrite of a session record. Writes only if the session is still listed in its
 * subject index (logout-all / revocation removes it there first) and the stored JSON is exactly
 * what the caller read, so a concurrent revoke can never resurrect a record and a sliding touch
 * can never undo a concurrent patch.
 *   KEYS: session key, subject index key
 *   ARGV: session id, expected JSON, new JSON, ttl seconds ("" = keep the current TTL)
 *   returns 1 written, 0 record changed meanwhile, -1 gone / revoked
 */
const CAS_SESSION_SCRIPT = `
if redis.call('SISMEMBER', KEYS[2], ARGV[1]) == 0 then return -1 end
local current = redis.call('GET', KEYS[1])
if not current then return -1 end
if current ~= ARGV[2] then return 0 end
if ARGV[4] == '' then
  redis.call('SET', KEYS[1], ARGV[3], 'KEEPTTL')
else
  redis.call('SET', KEYS[1], ARGV[3], 'EX', ARGV[4])
end
return 1
`;
/**
 * Server-side sessions in Redis.
 *  - token: 256-bit random, base64url, sent only as an httpOnly cookie; Redis key is its SHA-256
 *    (the hash doubles as the public session id shown in "logged-in devices")
 *  - sliding idle expiry + absolute max age; per-subject index set for listing / logout-all
 *  - CSRF synchronizer token bound to the session (double-submitted via cookie + header)
 */
let SessionService = class SessionService {
    constructor(redis, config) {
        this.redis = redis;
        this.config = config;
    }
    async create(input) {
        const token = (0, node_crypto_1.randomBytes)(32).toString('base64url');
        const id = hashSessionToken(token);
        const now = Date.now();
        const { absolute } = this.ttls(input.kind);
        const idle = input.idleTtlSeconds ?? this.ttls(input.kind).idle;
        const subjectId = input.kind === 'USER' ? input.userId : input.adminId;
        const record = {
            id,
            kind: input.kind,
            subjectId,
            role: input.role,
            agencyId: input.kind === 'USER' ? (input.agencyId ?? null) : null,
            mfaVerified: input.kind === 'ADMIN' ? input.mfaVerified : false,
            csrfToken: (0, node_crypto_1.randomBytes)(32).toString('base64url'),
            createdAt: now,
            lastSeenAt: now,
            absoluteExpiresAt: now + absolute * 1000,
            ...(input.idleTtlSeconds ? { idleTtlSeconds: input.idleTtlSeconds } : {}),
            ...(input.kind === 'ADMIN' && input.ipAllowlist?.length
                ? { ipAllowlist: input.ipAllowlist }
                : {}),
            ip: input.ip ?? null,
            userAgent: input.userAgent?.slice(0, 300) ?? null,
        };
        const indexKey = subjectKey(input.kind, subjectId);
        await this.redis
            .multi()
            .set(sessionKey(id), JSON.stringify(record), 'EX', Math.min(idle, absolute))
            .sadd(indexKey, id)
            .expire(indexKey, absolute)
            .exec();
        return { token, record };
    }
    /** Looks up a raw token; refreshes sliding expiry. Returns null when missing/expired. */
    async findByToken(token) {
        if (!TOKEN_PATTERN.test(token))
            return null;
        return this.findById(hashSessionToken(token), true);
    }
    /** SessionResolver: admin paths read the admin cookie, everything else the user cookie. */
    async resolve(req) {
        const kind = (0, session_resolver_1.isAdminPath)(req) ? 'ADMIN' : 'USER';
        const token = readSessionCookie(req, kind);
        if (!token)
            return null;
        const record = await this.findByToken(token);
        if (!record || record.kind !== kind)
            return null;
        // A stolen admin cookie is useless outside the account's allowed networks.
        if (record.kind === 'ADMIN' && !(0, ip_allowlist_1.ipAllowed)(record.ipAllowlist, req.ip))
            return null;
        return { principal: toPrincipal(record), csrfToken: record.csrfToken };
    }
    /** Updates mutable fields of the session behind a raw token. */
    async update(token, patch) {
        if (!TOKEN_PATTERN.test(token))
            return;
        await this.updateById(hashSessionToken(token), patch);
    }
    /**
     * Updates mutable fields (e.g. agencyId/role after agency approval) keeping the TTL. Atomic
     * against concurrent touches / patches (retried CAS) and never recreates a revoked session.
     */
    async updateById(id, patch) {
        for (let attempt = 0; attempt < PATCH_RETRIES; attempt++) {
            const raw = await this.redis.get(sessionKey(id));
            if (!raw)
                return;
            const current = JSON.parse(raw);
            const next = JSON.stringify({ ...current, ...patch });
            const result = await this.compareAndSet(current, raw, next, null);
            if (result !== 0)
                return;
        }
        throw new Error(`session ${id.slice(0, 8)}… kept changing; patch not applied`);
    }
    /** Applies a patch to every live session of a subject (role change, agency membership change). */
    async updateAllForSubject(kind, subjectId, patch) {
        const ids = await this.redis.smembers(subjectKey(kind, subjectId));
        await Promise.all(ids.map((id) => this.updateById(id, patch)));
    }
    /** Live sessions of a subject, most recently used first. Stale index entries are pruned. */
    async listForSubject(kind, subjectId) {
        const indexKey = subjectKey(kind, subjectId);
        const ids = await this.redis.smembers(indexKey);
        if (ids.length === 0)
            return [];
        const raws = await this.redis.mget(...ids.map(sessionKey));
        const now = Date.now();
        const live = [];
        const stale = [];
        raws.forEach((raw, i) => {
            const record = raw ? JSON.parse(raw) : null;
            if (record && record.subjectId === subjectId && now < record.absoluteExpiresAt)
                live.push(record);
            else
                stale.push(ids[i]);
        });
        if (stale.length > 0)
            await this.redis.srem(indexKey, ...stale);
        return live.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    }
    async destroy(token) {
        if (!TOKEN_PATTERN.test(token))
            return;
        const record = await this.findById(hashSessionToken(token), false);
        if (record)
            await this.destroyRecord(record);
    }
    /** Revokes one session of the subject. Returns false when it is not theirs (or gone). */
    async destroyForSubject(kind, subjectId, id) {
        const record = await this.findById(id, false);
        if (!record || record.kind !== kind || record.subjectId !== subjectId)
            return false;
        await this.destroyRecord(record);
        return true;
    }
    /** Logout everywhere (also used on password change / suspension / withdrawal). */
    async destroyAllForSubject(kind, subjectId) {
        const indexKey = subjectKey(kind, subjectId);
        const ids = await this.redis.smembers(indexKey);
        if (ids.length === 0)
            return 0;
        await this.redis
            .multi()
            .del(...ids.map(sessionKey))
            .del(indexKey)
            .exec();
        return ids.length;
    }
    setCookies(res, kind, token, record) {
        const maxAge = Math.max(0, record.absoluteExpiresAt - Date.now());
        res.cookie(sessionCookieName(kind), token, { ...this.baseCookie(), httpOnly: true, maxAge });
        res.cookie(shared_1.COOKIE_NAMES.CSRF, record.csrfToken, {
            ...this.baseCookie(),
            httpOnly: false,
            maxAge,
        });
    }
    /** Re-issues only the CSRF cookie (GET /auth/csrf). */
    setCsrfCookie(res, csrfToken, maxAgeMs) {
        res.cookie(shared_1.COOKIE_NAMES.CSRF, csrfToken, {
            ...this.baseCookie(),
            httpOnly: false,
            ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
        });
    }
    clearCookies(res, kind) {
        res.clearCookie(sessionCookieName(kind), this.baseCookie());
        res.clearCookie(shared_1.COOKIE_NAMES.CSRF, this.baseCookie());
    }
    /** Cookie attributes shared by every auth cookie (Secure in prod, SameSite=Lax). */
    baseCookie() {
        return {
            secure: this.config.cookieSecure,
            sameSite: 'lax',
            path: '/',
            domain: this.config.get('COOKIE_DOMAIN'),
        };
    }
    /**
     * A record counts only while it is listed in its subject index: logout-all deletes the index
     * together with the records, so a record orphaned by a create/logout-all race is treated as revoked.
     */
    async findById(id, touch) {
        const raw = await this.redis.get(sessionKey(id));
        if (!raw)
            return null;
        const record = JSON.parse(raw);
        if (record.id !== id)
            return null;
        const indexed = await this.redis.sismember(subjectKey(record.kind, record.subjectId), id);
        if (indexed !== 1)
            return null;
        const now = Date.now();
        if (now >= record.absoluteExpiresAt) {
            await this.destroyRecord(record);
            return null;
        }
        if (touch && now - record.lastSeenAt >= TOUCH_INTERVAL_MS) {
            const touched = { ...record, lastSeenAt: now };
            const idle = record.idleTtlSeconds ?? this.ttls(record.kind).idle;
            const ttl = Math.min(idle, Math.ceil((record.absoluteExpiresAt - now) / 1000));
            const result = await this.compareAndSet(record, raw, JSON.stringify(touched), Math.max(ttl, 1));
            // -1: revoked between our read and the write. 0: patched meanwhile; the next request
            // (within TOUCH_INTERVAL_MS) slides the expiry instead.
            if (result === -1)
                return null;
            return result === 1 ? touched : record;
        }
        return record;
    }
    async compareAndSet(record, expectedRaw, nextRaw, ttlSeconds) {
        const result = await this.redis.eval(CAS_SESSION_SCRIPT, 2, sessionKey(record.id), subjectKey(record.kind, record.subjectId), record.id, expectedRaw, nextRaw, ttlSeconds === null ? '' : String(ttlSeconds));
        return result === 1 ? 1 : result === 0 ? 0 : -1;
    }
    ttls(kind) {
        return kind === 'ADMIN'
            ? {
                idle: this.config.get('ADMIN_SESSION_IDLE_TTL_SECONDS'),
                absolute: this.config.get('ADMIN_SESSION_ABSOLUTE_TTL_SECONDS'),
            }
            : {
                idle: this.config.get('SESSION_IDLE_TTL_SECONDS'),
                absolute: this.config.get('SESSION_ABSOLUTE_TTL_SECONDS'),
            };
    }
    async destroyRecord(record) {
        await this.redis
            .multi()
            .del(sessionKey(record.id))
            .srem(subjectKey(record.kind, record.subjectId), record.id)
            .exec();
    }
};
exports.SessionService = SessionService;
exports.SessionService = SessionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS)),
    __metadata("design:paramtypes", [Function, app_config_service_1.AppConfig])
], SessionService);
function hashSessionToken(token) {
    return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
}
function sessionCookieName(kind) {
    return kind === 'ADMIN' ? shared_1.COOKIE_NAMES.ADMIN_SESSION : shared_1.COOKIE_NAMES.SESSION;
}
function readSessionCookie(req, kind) {
    const cookies = req.cookies;
    const value = cookies?.[sessionCookieName(kind)];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}
function sessionKey(id) {
    return `session:${id}`;
}
function subjectKey(kind, subjectId) {
    return `session-index:${kind}:${subjectId}`;
}
function toPrincipal(r) {
    return r.kind === 'ADMIN'
        ? {
            kind: 'ADMIN',
            adminId: r.subjectId,
            role: r.role,
            sessionId: r.id,
            mfaVerified: r.mfaVerified,
        }
        : {
            kind: 'USER',
            userId: r.subjectId,
            role: r.role,
            agencyId: r.agencyId,
            sessionId: r.id,
        };
}
//# sourceMappingURL=session.service.js.map