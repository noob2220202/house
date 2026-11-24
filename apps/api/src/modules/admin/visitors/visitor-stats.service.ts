import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { kstDateKey } from '../../../common/throttle/daily-cap.service';
import { InjectRedis } from '../../../redis/redis.constants';
import {
  DEVICE_KEY_PREFIX,
  PAGEVIEW_KEY_PREFIX,
  VISITOR_KEY_PREFIX,
  VISITOR_KEY_TTL_SECONDS,
} from '../constants';

export type DeviceClass = 'mobile' | 'desktop';

/** Phones and tablets count as mobile (the web is mobile-first; tablets use the mobile layout). */
export function deviceClassOf(userAgent: string | null | undefined): DeviceClass {
  return /Mobi|Android|iPhone|iPad|iPod|Mobile Safari|Opera Mini|IEMobile|SamsungBrowser/i.test(
    userAgent ?? '',
  )
    ? 'mobile'
    : 'desktop';
}

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

  /**
   * One counted request: the visitor joins the day's HyperLogLog, and the day's request counter
   * (`pageViews` of the stats page — public API reads by visitors, a proxy for page views) and
   * device split are incremented.
   */
  async record(id: string, now: Date = new Date(), device: DeviceClass = 'desktop'): Promise<void> {
    const day = kstDateKey(now);
    const key = `${VISITOR_KEY_PREFIX}${day}`;
    const views = `${PAGEVIEW_KEY_PREFIX}${day}`;
    const devices = `${DEVICE_KEY_PREFIX}${day}`;
    await this.redis
      .multi()
      .pfadd(key, id)
      .expire(key, VISITOR_KEY_TTL_SECONDS)
      .incr(views)
      .expire(views, VISITOR_KEY_TTL_SECONDS)
      .hincrby(devices, device, 1)
      .expire(devices, VISITOR_KEY_TTL_SECONDS)
      .exec();
  }

  /** Never awaited on the request path; a Redis hiccup must not fail page loads. */
  recordSafe(id: string, now: Date = new Date(), device: DeviceClass = 'desktop'): void {
    this.record(id, now, device).catch((err: unknown) =>
      this.logger.warn({ err }, 'visitor counter update failed'),
    );
  }

  /**
   * Per KST day for the last `days` days (oldest first): unique visitors, counted requests and
   * the mobile / desktop split of those requests.
   */
  async dailyTraffic(
    days: number,
    now: Date = new Date(),
  ): Promise<
    { date: string; visitors: number; pageViews: number; mobile: number; desktop: number }[]
  > {
    const keys = Array.from({ length: days }, (_, i) =>
      kstDateKey(new Date(now.getTime() - (days - 1 - i) * DAY_MS)),
    );
    const pipeline = this.redis.pipeline();
    for (const k of keys) {
      pipeline.pfcount(`${VISITOR_KEY_PREFIX}${k}`);
      pipeline.get(`${PAGEVIEW_KEY_PREFIX}${k}`);
      pipeline.hmget(`${DEVICE_KEY_PREFIX}${k}`, 'mobile', 'desktop');
    }
    const results = (await pipeline.exec()) ?? [];
    const num = (v: unknown) => {
      const n = Number(v ?? 0);
      return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
    };
    return keys.map((k, i) => {
      const [vErr, visitors] = results[i * 3] ?? [];
      const [pErr, views] = results[i * 3 + 1] ?? [];
      const [dErr, split] = results[i * 3 + 2] ?? [];
      const [mobile, desktop] = dErr ? [0, 0] : ((split as unknown[] | null) ?? []).map(num);
      return {
        date: isoDay(k),
        visitors: vErr ? 0 : num(visitors),
        pageViews: pErr ? 0 : num(views),
        mobile: mobile ?? 0,
        desktop: desktop ?? 0,
      };
    });
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
