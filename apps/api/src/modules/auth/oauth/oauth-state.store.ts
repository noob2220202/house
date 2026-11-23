import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { AuthProvider, OAuthIntent } from '@house/shared';
import type Redis from 'ioredis';
import { REDIS } from '../../../redis/redis.constants';
import { OAUTH_STATE_TTL_SECONDS, REDIS_KEYS } from '../auth.constants';

export interface OAuthStateRecord {
  provider: AuthProvider;
  intent: OAuthIntent;
  nonce: string;
  codeVerifier: string;
  /** SHA-256 of the browser-binding cookie value. */
  bindingHash: string;
  returnTo: string | null;
  /** intent=link: the user the identity will be attached to. */
  linkUserId: string | null;
  createdAt: number;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** RFC 7636 S256 code challenge. */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

const STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** OAuth `state` records in Redis: short TTL, single use (GETDEL). */
@Injectable()
export class OAuthStateStore {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async create(input: Omit<OAuthStateRecord, 'createdAt'>): Promise<string> {
    const state = randomToken();
    const record: OAuthStateRecord = { ...input, createdAt: Date.now() };
    await this.redis.set(
      REDIS_KEYS.oauthState(state),
      JSON.stringify(record),
      'EX',
      OAUTH_STATE_TTL_SECONDS,
    );
    return state;
  }

  /** Returns and deletes the record (a state can be redeemed once). */
  async consume(state: string): Promise<OAuthStateRecord | null> {
    if (!STATE_PATTERN.test(state)) return null;
    const raw = await this.redis.getdel(REDIS_KEYS.oauthState(state));
    return raw ? (JSON.parse(raw) as OAuthStateRecord) : null;
  }
}
