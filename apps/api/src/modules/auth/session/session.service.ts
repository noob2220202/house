import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AdminRole, COOKIE_NAMES, UserRole } from '@house/shared';
import type { CookieOptions, Request, Response } from 'express';
import type Redis from 'ioredis';
import {
  isAdminPath,
  ResolvedSession,
  SessionResolver,
} from '../../../common/auth/session-resolver';
import type { Principal } from '../../../common/auth/principal';
import { AppConfig } from '../../../config/app-config.service';
import { REDIS } from '../../../redis/redis.constants';
import { ipAllowed } from '../admin/ip-allowlist';
import type { CreateSessionInput, SessionKind, SessionPatch, SessionRecord } from './session.types';

/** Don't rewrite the record on every request; refresh sliding expiry at most this often. */
const TOUCH_INTERVAL_MS = 60_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Server-side sessions in Redis.
 *  - token: 256-bit random, base64url, sent only as an httpOnly cookie; Redis key is its SHA-256
 *    (the hash doubles as the public session id shown in "logged-in devices")
 *  - sliding idle expiry + absolute max age; per-subject index set for listing / logout-all
 *  - CSRF synchronizer token bound to the session (double-submitted via cookie + header)
 */
@Injectable()
export class SessionService implements SessionResolver {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: AppConfig,
  ) {}

  async create(input: CreateSessionInput): Promise<{ token: string; record: SessionRecord }> {
    const token = randomBytes(32).toString('base64url');
    const id = hashSessionToken(token);
    const now = Date.now();
    const { absolute } = this.ttls(input.kind);
    const idle = input.idleTtlSeconds ?? this.ttls(input.kind).idle;
    const subjectId = input.kind === 'USER' ? input.userId : input.adminId;
    const record: SessionRecord = {
      id,
      kind: input.kind,
      subjectId,
      role: input.role,
      agencyId: input.kind === 'USER' ? (input.agencyId ?? null) : null,
      mfaVerified: input.kind === 'ADMIN' ? input.mfaVerified : false,
      csrfToken: randomBytes(32).toString('base64url'),
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
  async findByToken(token: string): Promise<SessionRecord | null> {
    if (!TOKEN_PATTERN.test(token)) return null;
    return this.findById(hashSessionToken(token), true);
  }

  /** SessionResolver: admin paths read the admin cookie, everything else the user cookie. */
  async resolve(req: Request): Promise<ResolvedSession | null> {
    const kind: SessionKind = isAdminPath(req) ? 'ADMIN' : 'USER';
    const token = readSessionCookie(req, kind);
    if (!token) return null;
    const record = await this.findByToken(token);
    if (!record || record.kind !== kind) return null;
    // A stolen admin cookie is useless outside the account's allowed networks.
    if (record.kind === 'ADMIN' && !ipAllowed(record.ipAllowlist, req.ip)) return null;
    return { principal: toPrincipal(record), csrfToken: record.csrfToken };
  }

  /** Updates mutable fields of the session behind a raw token. */
  async update(token: string, patch: SessionPatch): Promise<void> {
    if (!TOKEN_PATTERN.test(token)) return;
    await this.updateById(hashSessionToken(token), patch);
  }

  /** Updates mutable fields (e.g. agencyId/role after agency approval) keeping the TTL. */
  async updateById(id: string, patch: SessionPatch): Promise<void> {
    const key = sessionKey(id);
    const [raw, ttl] = await Promise.all([this.redis.get(key), this.redis.ttl(key)]);
    if (!raw || ttl <= 0) return;
    const record = { ...(JSON.parse(raw) as SessionRecord), ...patch };
    await this.redis.set(key, JSON.stringify(record), 'EX', ttl);
  }

  /** Applies a patch to every live session of a subject (role change, agency membership change). */
  async updateAllForSubject(kind: SessionKind, subjectId: string, patch: SessionPatch) {
    const ids = await this.redis.smembers(subjectKey(kind, subjectId));
    await Promise.all(ids.map((id) => this.updateById(id, patch)));
  }

  /** Live sessions of a subject, most recently used first. Stale index entries are pruned. */
  async listForSubject(kind: SessionKind, subjectId: string): Promise<SessionRecord[]> {
    const indexKey = subjectKey(kind, subjectId);
    const ids = await this.redis.smembers(indexKey);
    if (ids.length === 0) return [];
    const raws = await this.redis.mget(...ids.map(sessionKey));
    const now = Date.now();
    const live: SessionRecord[] = [];
    const stale: string[] = [];
    raws.forEach((raw, i) => {
      const record = raw ? (JSON.parse(raw) as SessionRecord) : null;
      if (record && record.subjectId === subjectId && now < record.absoluteExpiresAt)
        live.push(record);
      else stale.push(ids[i] as string);
    });
    if (stale.length > 0) await this.redis.srem(indexKey, ...stale);
    return live.sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }

  async destroy(token: string): Promise<void> {
    if (!TOKEN_PATTERN.test(token)) return;
    const record = await this.findById(hashSessionToken(token), false);
    if (record) await this.destroyRecord(record);
  }

  /** Revokes one session of the subject. Returns false when it is not theirs (or gone). */
  async destroyForSubject(kind: SessionKind, subjectId: string, id: string): Promise<boolean> {
    const record = await this.findById(id, false);
    if (!record || record.kind !== kind || record.subjectId !== subjectId) return false;
    await this.destroyRecord(record);
    return true;
  }

  /** Logout everywhere (also used on password change / suspension / withdrawal). */
  async destroyAllForSubject(kind: SessionKind, subjectId: string): Promise<number> {
    const indexKey = subjectKey(kind, subjectId);
    const ids = await this.redis.smembers(indexKey);
    if (ids.length === 0) return 0;
    await this.redis
      .multi()
      .del(...ids.map(sessionKey))
      .del(indexKey)
      .exec();
    return ids.length;
  }

  setCookies(res: Response, kind: SessionKind, token: string, record: SessionRecord): void {
    const maxAge = Math.max(0, record.absoluteExpiresAt - Date.now());
    res.cookie(sessionCookieName(kind), token, { ...this.baseCookie(), httpOnly: true, maxAge });
    res.cookie(COOKIE_NAMES.CSRF, record.csrfToken, {
      ...this.baseCookie(),
      httpOnly: false,
      maxAge,
    });
  }

  /** Re-issues only the CSRF cookie (GET /auth/csrf). */
  setCsrfCookie(res: Response, csrfToken: string, maxAgeMs?: number): void {
    res.cookie(COOKIE_NAMES.CSRF, csrfToken, {
      ...this.baseCookie(),
      httpOnly: false,
      ...(maxAgeMs !== undefined ? { maxAge: maxAgeMs } : {}),
    });
  }

  clearCookies(res: Response, kind: SessionKind): void {
    res.clearCookie(sessionCookieName(kind), this.baseCookie());
    res.clearCookie(COOKIE_NAMES.CSRF, this.baseCookie());
  }

  /** Cookie attributes shared by every auth cookie (Secure in prod, SameSite=Lax). */
  baseCookie(): CookieOptions {
    return {
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path: '/',
      domain: this.config.get('COOKIE_DOMAIN'),
    };
  }

  private async findById(id: string, touch: boolean): Promise<SessionRecord | null> {
    const raw = await this.redis.get(sessionKey(id));
    if (!raw) return null;
    const record = JSON.parse(raw) as SessionRecord;
    const now = Date.now();
    if (now >= record.absoluteExpiresAt) {
      await this.destroyRecord(record);
      return null;
    }
    if (touch && now - record.lastSeenAt >= TOUCH_INTERVAL_MS) {
      record.lastSeenAt = now;
      const idle = record.idleTtlSeconds ?? this.ttls(record.kind).idle;
      const ttl = Math.min(idle, Math.ceil((record.absoluteExpiresAt - now) / 1000));
      await this.redis.set(sessionKey(id), JSON.stringify(record), 'EX', Math.max(ttl, 1));
    }
    return record;
  }

  private ttls(kind: SessionKind): { idle: number; absolute: number } {
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

  private async destroyRecord(record: SessionRecord): Promise<void> {
    await this.redis
      .multi()
      .del(sessionKey(record.id))
      .srem(subjectKey(record.kind, record.subjectId), record.id)
      .exec();
  }
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function sessionCookieName(kind: SessionKind): string {
  return kind === 'ADMIN' ? COOKIE_NAMES.ADMIN_SESSION : COOKIE_NAMES.SESSION;
}

export function readSessionCookie(req: Request, kind: SessionKind): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const value = cookies?.[sessionCookieName(kind)];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function sessionKey(id: string): string {
  return `session:${id}`;
}

function subjectKey(kind: SessionKind, subjectId: string): string {
  return `session-index:${kind}:${subjectId}`;
}

function toPrincipal(r: SessionRecord): Principal {
  return r.kind === 'ADMIN'
    ? {
        kind: 'ADMIN',
        adminId: r.subjectId,
        role: r.role as AdminRole,
        sessionId: r.id,
        mfaVerified: r.mfaVerified,
      }
    : {
        kind: 'USER',
        userId: r.subjectId,
        role: r.role as UserRole,
        agencyId: r.agencyId,
        sessionId: r.id,
      };
}
