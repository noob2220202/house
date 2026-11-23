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
import type { CreateSessionInput, SessionKind, SessionRecord } from './session.types';

/** Don't rewrite the record on every request; refresh sliding expiry at most this often. */
const TOUCH_INTERVAL_MS = 60_000;

/**
 * Server-side sessions in Redis.
 *  - token: 256-bit random, base64url, sent only as an httpOnly cookie; Redis key is its SHA-256
 *  - sliding idle expiry + absolute max age; per-subject index set for logout-all
 * Owned by the auth module team (baseline implemented by the scaffold so other modules can test).
 */
@Injectable()
export class SessionService implements SessionResolver {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: AppConfig,
  ) {}

  async create(input: CreateSessionInput): Promise<{ token: string; record: SessionRecord }> {
    const token = randomBytes(32).toString('base64url');
    const id = hashToken(token);
    const now = Date.now();
    const { idle, absolute } = this.ttls(input.kind);
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
      ip: input.ip ?? null,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
    };
    const indexKey = subjectKey(input.kind, subjectId);
    await this.redis
      .multi()
      .set(sessionKey(id), JSON.stringify(record), 'EX', idle)
      .sadd(indexKey, id)
      .expire(indexKey, absolute)
      .exec();
    return { token, record };
  }

  /** Looks up a raw token; refreshes sliding expiry. Returns null when missing/expired. */
  async findByToken(token: string): Promise<SessionRecord | null> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const id = hashToken(token);
    const raw = await this.redis.get(sessionKey(id));
    if (!raw) return null;
    const record = JSON.parse(raw) as SessionRecord;
    const now = Date.now();
    if (now >= record.absoluteExpiresAt) {
      await this.destroyById(record);
      return null;
    }
    if (now - record.lastSeenAt >= TOUCH_INTERVAL_MS) {
      record.lastSeenAt = now;
      const { idle } = this.ttls(record.kind);
      const ttl = Math.min(idle, Math.ceil((record.absoluteExpiresAt - now) / 1000));
      await this.redis.set(sessionKey(id), JSON.stringify(record), 'EX', Math.max(ttl, 1));
    }
    return record;
  }

  /** SessionResolver: admin paths read the admin cookie, everything else the user cookie. */
  async resolve(req: Request): Promise<ResolvedSession | null> {
    const kind: SessionKind = isAdminPath(req) ? 'ADMIN' : 'USER';
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const token = cookies?.[kind === 'ADMIN' ? COOKIE_NAMES.ADMIN_SESSION : COOKIE_NAMES.SESSION];
    if (!token) return null;
    const record = await this.findByToken(token);
    if (!record || record.kind !== kind) return null;
    return { principal: toPrincipal(record), csrfToken: record.csrfToken };
  }

  /** Updates mutable fields (e.g. mfaVerified after TOTP, agencyId after approval). */
  async update(
    token: string,
    patch: Partial<Pick<SessionRecord, 'mfaVerified' | 'agencyId' | 'role'>>,
  ): Promise<void> {
    const id = hashToken(token);
    const key = sessionKey(id);
    const raw = await this.redis.get(key);
    if (!raw) return;
    const ttl = await this.redis.ttl(key);
    const record = { ...(JSON.parse(raw) as SessionRecord), ...patch };
    await this.redis.set(key, JSON.stringify(record), 'EX', Math.max(ttl, 1));
  }

  async destroy(token: string): Promise<void> {
    const raw = await this.redis.get(sessionKey(hashToken(token)));
    if (raw) await this.destroyById(JSON.parse(raw) as SessionRecord);
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
    const maxAge = this.ttls(kind).absolute * 1000;
    res.cookie(kind === 'ADMIN' ? COOKIE_NAMES.ADMIN_SESSION : COOKIE_NAMES.SESSION, token, {
      ...this.baseCookie(),
      httpOnly: true,
      maxAge,
    });
    res.cookie(COOKIE_NAMES.CSRF, record.csrfToken, {
      ...this.baseCookie(),
      httpOnly: false,
      maxAge,
    });
  }

  clearCookies(res: Response, kind: SessionKind): void {
    res.clearCookie(
      kind === 'ADMIN' ? COOKIE_NAMES.ADMIN_SESSION : COOKIE_NAMES.SESSION,
      this.baseCookie(),
    );
    res.clearCookie(COOKIE_NAMES.CSRF, this.baseCookie());
  }

  private baseCookie(): CookieOptions {
    return {
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path: '/',
      domain: this.config.get('COOKIE_DOMAIN'),
    };
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

  private async destroyById(record: SessionRecord): Promise<void> {
    await this.redis
      .multi()
      .del(sessionKey(record.id))
      .srem(subjectKey(record.kind, record.subjectId), record.id)
      .exec();
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
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
