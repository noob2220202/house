import { createHash, randomBytes } from 'node:crypto';
import {
  AGENCY_INVITE_CODE_ALPHABET,
  AGENCY_INVITE_CODE_LENGTH,
  type AgencyInviteView,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../../../redis/redis.constants';
import { AGENCY_REDIS } from '../constants';

/** Upper bound of agencyInviteCreateSchema.expiresInHours, plus a margin. */
const MAX_INVITE_TTL_SECONDS = 15 * 24 * 60 * 60;

export interface InviteRecord {
  id: string;
  agencyId: string;
  codeHash: string;
  codeHint: string;
  label: string | null;
  createdByUserId: string;
  createdAt: number;
  expiresAt: number;
}

/** Uniform random code over the 32-char alphabet (256 % 32 === 0, so no modulo bias). */
export function generateInviteCode(): string {
  const bytes = randomBytes(AGENCY_INVITE_CODE_LENGTH);
  let code = '';
  for (const b of bytes)
    code += AGENCY_INVITE_CODE_ALPHABET[b % AGENCY_INVITE_CODE_ALPHABET.length];
  return code;
}

export function hashInviteCode(code: string): string {
  return createHash('sha256').update(`agency-invite:${code}`).digest('hex');
}

export function toInviteView(r: InviteRecord, code?: string): AgencyInviteView {
  return {
    id: r.id,
    ...(code ? { code } : {}),
    codeHint: r.codeHint,
    label: r.label,
    createdAt: new Date(r.createdAt).toISOString(),
    expiresAt: new Date(r.expiresAt).toISOString(),
  };
}

/**
 * Staff invite codes in Redis. Only sha256(code) is stored; the code is shown to the owner once.
 * Redemption is single-use via GETDEL on the code key. Records expire on their own (TTL), the
 * per-agency ZSET is pruned lazily.
 */
@Injectable()
export class AgencyInviteStore {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async create(input: {
    agencyId: string;
    createdByUserId: string;
    label: string | null;
    ttlSeconds: number;
    now?: number;
  }): Promise<{ record: InviteRecord; code: string }> {
    const now = input.now ?? Date.now();
    const code = generateInviteCode();
    const record: InviteRecord = {
      id: randomBytes(12).toString('hex'),
      agencyId: input.agencyId,
      codeHash: hashInviteCode(code),
      codeHint: code.slice(-4),
      label: input.label,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      expiresAt: now + input.ttlSeconds * 1000,
    };
    const indexKey = AGENCY_REDIS.agencyInvites(input.agencyId);
    await this.redis
      .multi()
      .set(AGENCY_REDIS.invite(record.id), JSON.stringify(record), 'EX', input.ttlSeconds)
      .set(AGENCY_REDIS.inviteCode(record.codeHash), record.id, 'EX', input.ttlSeconds)
      .zadd(indexKey, record.expiresAt, record.id)
      // Index outlives every invite in it (each add re-arms it to the maximum invite lifetime).
      .expire(indexKey, MAX_INVITE_TTL_SECONDS)
      .exec();
    return { record, code };
  }

  /** Live invites of an agency, newest first (expired index entries are pruned). */
  async listForAgency(agencyId: string, now = Date.now()): Promise<InviteRecord[]> {
    const indexKey = AGENCY_REDIS.agencyInvites(agencyId);
    await this.redis.zremrangebyscore(indexKey, '-inf', now);
    const ids = await this.redis.zrange(indexKey, 0, -1);
    if (ids.length === 0) return [];
    const raws = await this.redis.mget(...ids.map((id) => AGENCY_REDIS.invite(id)));
    const live: InviteRecord[] = [];
    const stale: string[] = [];
    raws.forEach((raw, i) => {
      const r = raw ? (JSON.parse(raw) as InviteRecord) : null;
      if (r && r.agencyId === agencyId && r.expiresAt > now) live.push(r);
      else stale.push(ids[i] as string);
    });
    if (stale.length > 0) await this.redis.zrem(indexKey, ...stale);
    return live.sort((a, b) => b.createdAt - a.createdAt);
  }

  async countForAgency(agencyId: string, now = Date.now()): Promise<number> {
    return (await this.listForAgency(agencyId, now)).length;
  }

  /** Looks up a code without consuming it. */
  async peek(code: string, now = Date.now()): Promise<InviteRecord | null> {
    const id = await this.redis.get(AGENCY_REDIS.inviteCode(hashInviteCode(code)));
    if (!id) return null;
    return this.load(id, now);
  }

  /** Atomically claims the code (single use). Returns null if someone else already used it. */
  async consume(code: string, now = Date.now()): Promise<InviteRecord | null> {
    const id = await this.redis.getdel(AGENCY_REDIS.inviteCode(hashInviteCode(code)));
    if (!id) return null;
    const record = await this.load(id, now);
    if (!record) return null;
    await this.redis
      .multi()
      .del(AGENCY_REDIS.invite(id))
      .zrem(AGENCY_REDIS.agencyInvites(record.agencyId), id)
      .exec();
    return record;
  }

  /** Puts a consumed invite back (the join transaction failed after claiming it). */
  async restore(record: InviteRecord, now = Date.now()): Promise<void> {
    const ttlMs = record.expiresAt - now;
    if (ttlMs <= 0) return;
    await this.redis
      .multi()
      .set(AGENCY_REDIS.invite(record.id), JSON.stringify(record), 'PX', ttlMs)
      .set(AGENCY_REDIS.inviteCode(record.codeHash), record.id, 'PX', ttlMs)
      .zadd(AGENCY_REDIS.agencyInvites(record.agencyId), record.expiresAt, record.id)
      .exec();
  }

  /** Revokes an invite of `agencyId`; false when it does not exist (or belongs elsewhere). */
  async revoke(agencyId: string, inviteId: string, now = Date.now()): Promise<boolean> {
    const record = await this.load(inviteId, now);
    if (!record || record.agencyId !== agencyId) return false;
    await this.redis
      .multi()
      .del(AGENCY_REDIS.invite(inviteId))
      .del(AGENCY_REDIS.inviteCode(record.codeHash))
      .zrem(AGENCY_REDIS.agencyInvites(agencyId), inviteId)
      .exec();
    return true;
  }

  /** Revokes every invite of an agency (suspension). */
  async revokeAll(agencyId: string): Promise<void> {
    const records = await this.listForAgency(agencyId);
    const multi = this.redis.multi();
    for (const r of records) {
      multi.del(AGENCY_REDIS.invite(r.id)).del(AGENCY_REDIS.inviteCode(r.codeHash));
    }
    multi.del(AGENCY_REDIS.agencyInvites(agencyId));
    await multi.exec();
  }

  private async load(id: string, now: number): Promise<InviteRecord | null> {
    const raw = await this.redis.get(AGENCY_REDIS.invite(id));
    if (!raw) return null;
    const record = JSON.parse(raw) as InviteRecord;
    return record.expiresAt > now ? record : null;
  }
}
