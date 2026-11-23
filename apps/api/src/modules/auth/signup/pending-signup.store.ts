import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../../../redis/redis.constants';
import { PENDING_SIGNUP_TTL_SECONDS, REDIS_KEYS } from '../auth.constants';
import type { OAuthProfile } from '../oauth/oauth-provider';
import { randomToken, sha256Hex } from '../oauth/oauth-state.store';

export interface PendingSignup {
  profile: OAuthProfile;
  returnTo: string | null;
  createdAt: number;
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * A first-time social login is parked here until the user agrees to the terms (POST /auth/signup).
 * No User row exists before that, so abandoned signups leave nothing behind.
 */
@Injectable()
export class PendingSignupStore {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async create(profile: OAuthProfile, returnTo: string | null): Promise<string> {
    const token = randomToken();
    const value: PendingSignup = { profile, returnTo, createdAt: Date.now() };
    await this.redis.set(
      REDIS_KEYS.pendingSignup(sha256Hex(token)),
      JSON.stringify(value),
      'EX',
      PENDING_SIGNUP_TTL_SECONDS,
    );
    return token;
  }

  async get(token: string | undefined): Promise<PendingSignup | null> {
    if (!token || !TOKEN_PATTERN.test(token)) return null;
    const raw = await this.redis.get(REDIS_KEYS.pendingSignup(sha256Hex(token)));
    return raw ? (JSON.parse(raw) as PendingSignup) : null;
  }

  async delete(token: string): Promise<void> {
    if (!TOKEN_PATTERN.test(token)) return;
    await this.redis.del(REDIS_KEYS.pendingSignup(sha256Hex(token)));
  }
}
