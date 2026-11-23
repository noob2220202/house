import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { kstDateKey } from '../../../common/throttle/daily-cap.service';
import { InjectRedis } from '../../../redis/redis.constants';
import { VISITOR_KEY_PREFIX, VISITOR_KEY_TTL_SECONDS } from '../constants';

const DAY_MS = 86_400_000;

/** A stable, non-reversible visitor id: the session when logged in, else ip + user agent. */
export function visitorId(input: {
  sessionToken?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): string {
  const source = input.sessionToken
    ? `s:${input.sessionToken}`
    : `a:${input.ip ?? ''}|${input.userAgent ?? ''}`;
  return createHash('sha256').update(source).digest('base64url').slice(0, 22);
}

/** "YYYYMMDD" → "YYYY-MM-DD" */
function isoDay(key: string): string {
  return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
}

/**
 * Unique daily visitors (KST days) in Redis HyperLogLogs: ~0.81% error, ≤12 KB per day, and the
 * sketch keeps no visitor ids (only register maxima), so nothing personal is stored.
 */
@Injectable()
export class VisitorStatsService {
  private readonly logger = new Logger(VisitorStatsService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async record(id: string, now: Date = new Date()): Promise<void> {
    const key = `${VISITOR_KEY_PREFIX}${kstDateKey(now)}`;
    await this.redis.multi().pfadd(key, id).expire(key, VISITOR_KEY_TTL_SECONDS).exec();
  }

  /** Never awaited on the request path; a Redis hiccup must not fail page loads. */
  recordSafe(id: string, now: Date = new Date()): void {
    this.record(id, now).catch((err: unknown) =>
      this.logger.warn({ err }, 'visitor counter update failed'),
    );
  }

  /** Daily unique counts for the last `days` KST days (oldest first) and their union. */
  async lastDays(
    days: number,
    now: Date = new Date(),
  ): Promise<{ daily: { date: string; count: number }[]; unique: number }> {
    const keys = Array.from({ length: days }, (_, i) =>
      kstDateKey(new Date(now.getTime() - (days - 1 - i) * DAY_MS)),
    );
    const pipeline = this.redis.pipeline();
    for (const k of keys) pipeline.pfcount(`${VISITOR_KEY_PREFIX}${k}`);
    pipeline.pfcount(...keys.map((k) => `${VISITOR_KEY_PREFIX}${k}`));
    const results = (await pipeline.exec()) ?? [];
    const counts = results.map(([err, value]) => (err ? 0 : Number(value)));
    return {
      daily: keys.map((k, i) => ({ date: isoDay(k), count: counts[i] ?? 0 })),
      unique: counts[keys.length] ?? 0,
    };
  }
}
