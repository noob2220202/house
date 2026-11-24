import type { CookieOptions, Request, Response } from 'express';
import type Redis from 'ioredis';
import { ResolvedSession, SessionResolver } from '../../../common/auth/session-resolver';
import { AppConfig } from '../../../config/app-config.service';
import type { CreateSessionInput, SessionKind, SessionPatch, SessionRecord } from './session.types';
/**
 * Server-side sessions in Redis.
 *  - token: 256-bit random, base64url, sent only as an httpOnly cookie; Redis key is its SHA-256
 *    (the hash doubles as the public session id shown in "logged-in devices")
 *  - sliding idle expiry + absolute max age; per-subject index set for listing / logout-all
 *  - CSRF synchronizer token bound to the session (double-submitted via cookie + header)
 */
export declare class SessionService implements SessionResolver {
    private readonly redis;
    private readonly config;
    constructor(redis: Redis, config: AppConfig);
    create(input: CreateSessionInput): Promise<{
        token: string;
        record: SessionRecord;
    }>;
    /** Looks up a raw token; refreshes sliding expiry. Returns null when missing/expired. */
    findByToken(token: string): Promise<SessionRecord | null>;
    /** SessionResolver: admin paths read the admin cookie, everything else the user cookie. */
    resolve(req: Request): Promise<ResolvedSession | null>;
    /** Updates mutable fields of the session behind a raw token. */
    update(token: string, patch: SessionPatch): Promise<void>;
    /**
     * Updates mutable fields (e.g. agencyId/role after agency approval) keeping the TTL. Atomic
     * against concurrent touches / patches (retried CAS) and never recreates a revoked session.
     */
    updateById(id: string, patch: SessionPatch): Promise<void>;
    /** Applies a patch to every live session of a subject (role change, agency membership change). */
    updateAllForSubject(kind: SessionKind, subjectId: string, patch: SessionPatch): Promise<void>;
    /** Live sessions of a subject, most recently used first. Stale index entries are pruned. */
    listForSubject(kind: SessionKind, subjectId: string): Promise<SessionRecord[]>;
    destroy(token: string): Promise<void>;
    /** Revokes one session of the subject. Returns false when it is not theirs (or gone). */
    destroyForSubject(kind: SessionKind, subjectId: string, id: string): Promise<boolean>;
    /** Logout everywhere (also used on password change / suspension / withdrawal). */
    destroyAllForSubject(kind: SessionKind, subjectId: string): Promise<number>;
    setCookies(res: Response, kind: SessionKind, token: string, record: SessionRecord): void;
    /** Re-issues only the CSRF cookie (GET /auth/csrf). */
    setCsrfCookie(res: Response, csrfToken: string, maxAgeMs?: number): void;
    clearCookies(res: Response, kind: SessionKind): void;
    /** Cookie attributes shared by every auth cookie (Secure in prod, SameSite=Lax). */
    baseCookie(): CookieOptions;
    /**
     * A record counts only while it is listed in its subject index: logout-all deletes the index
     * together with the records, so a record orphaned by a create/logout-all race is treated as revoked.
     */
    private findById;
    private compareAndSet;
    private ttls;
    private destroyRecord;
}
export declare function hashSessionToken(token: string): string;
export declare function sessionCookieName(kind: SessionKind): string;
export declare function readSessionCookie(req: Request, kind: SessionKind): string | undefined;
