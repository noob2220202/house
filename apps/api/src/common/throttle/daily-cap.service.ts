import { Inject, Injectable } from '@nestjs/common';
import { ErrorCode } from '@house/shared';
import type Redis from 'ioredis';
import { REDIS } from '../../redis/redis.constants';
import { AppException } from '../errors/app.exception';
import { DAILY_CAPS, type DailyCapKey } from './throttle.constants';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** "YYYYMMDD" of the current day in Asia/Seoul. */
export function kstDateKey(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10).replace(/-/g, '');
}

/** Seconds until the next KST midnight (min 1). */
export function secondsUntilKstMidnight(now: Date = new Date()): number {
  const kst = now.getTime() + KST_OFFSET_MS;
  const nextMidnight = Math.floor(kst / 86_400_000 + 1) * 86_400_000;
  return Math.max(1, Math.ceil((nextMidnight - kst) / 1000));
}

/**
 * Per-user daily caps backed by Redis counters (reset at KST midnight).
 *   await this.caps.consume('DEAL_REQUEST_CREATE', user.userId); // throws 429 RATE_LIMITED when over
 * Call it right before the write; it counts the attempt even if the write later fails, which is the
 * conservative choice for abuse control.
 */
@Injectable()
export class DailyCapService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async consume(key: DailyCapKey, subjectId: string, now: Date = new Date()): Promise<number> {
    const redisKey = `cap:${key}:${kstDateKey(now)}:${subjectId}`;
    const results = await this.redis
      .multi()
      .incr(redisKey)
      .expire(redisKey, secondsUntilKstMidnight(now) + 60)
      .exec();
    const count = Number(results?.[0]?.[1] ?? 0);
    if (count > DAILY_CAPS[key]) {
      throw new AppException(ErrorCode.RATE_LIMITED, {
        details: { cap: key, limit: DAILY_CAPS[key] },
      });
    }
    return count;
  }

  async used(key: DailyCapKey, subjectId: string, now: Date = new Date()): Promise<number> {
    return Number((await this.redis.get(`cap:${key}:${kstDateKey(now)}:${subjectId}`)) ?? 0);
  }
}
