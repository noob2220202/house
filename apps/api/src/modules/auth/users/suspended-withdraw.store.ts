import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../../../redis/redis.constants';
import { REDIS_KEYS, SUSPENDED_WITHDRAW_TTL_SECONDS } from '../auth.constants';
import { randomToken, sha256Hex } from '../oauth/oauth-state.store';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * A suspended member gets no session, but must still be able to withdraw (개인정보 보호법 제36·37조).
 * When their social login is refused for suspension, the OAuth callback parks a short-lived ticket
 * here (httpOnly cookie scoped to POST /auth/withdraw). The ticket proves a fresh login with the
 * account's own social identity and is good for nothing but that withdrawal.
 */
@Injectable()
export class SuspendedWithdrawStore {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async create(userId: string): Promise<string> {
    const token = randomToken();
    await this.redis.set(
      REDIS_KEYS.suspendedWithdraw(sha256Hex(token)),
      userId,
      'EX',
      SUSPENDED_WITHDRAW_TTL_SECONDS,
    );
    return token;
  }

  async get(token: string | undefined): Promise<string | null> {
    if (!token || !TOKEN_PATTERN.test(token)) return null;
    return this.redis.get(REDIS_KEYS.suspendedWithdraw(sha256Hex(token)));
  }

  async delete(token: string): Promise<void> {
    if (!TOKEN_PATTERN.test(token)) return;
    await this.redis.del(REDIS_KEYS.suspendedWithdraw(sha256Hex(token)));
  }
}
