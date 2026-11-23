import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { kstDayKey, type PopularComplexItem, type PopularComplexesQuery } from '@house/shared';
import type { Prisma } from '@prisma/client';
import type Redis from 'ioredis';
import type { Principal } from '../../../common/auth/principal';
import { CacheService } from '../../../common/cache/cache.service';
import { RequestContext } from '../../../common/context/request-context';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { InjectRedis } from '../../../redis/redis.constants';
import { COMPLEX_SUMMARY_SELECT, toComplexSummary } from '../complex.mapper';
import {
  CACHE_TTL_SECONDS,
  COMPLEXES_CACHE,
  COMPLEXES_REDIS_KEYS,
  POPULARITY_HALF_LIFE_DAYS,
  POPULARITY_WINDOW_DAYS,
  VIEW_DEDUPE_TTL_SECONDS,
  VIEWS_DAILY_TTL_SECONDS,
} from '../constants';
import { ComplexListingsService } from './complex-listings.service';

/**
 * KEYS: seen marker, daily ZSET, totals HASH; ARGV: id, DB count, dedupe TTL, daily TTL.
 * One counted view per viewer per KST day; the totals hash holds absolute totals seeded from the
 * DB so the flush can SET GREATEST(...) and re-running it is harmless.
 */
const RECORD_VIEW_LUA = `
if redis.call('SET', KEYS[1], '1', 'NX', 'EX', tonumber(ARGV[3])) then
  redis.call('ZINCRBY', KEYS[2], 1, ARGV[1])
  redis.call('EXPIRE', KEYS[2], tonumber(ARGV[4]))
  redis.call('HSETNX', KEYS[3], ARGV[1], ARGV[2])
  return redis.call('HINCRBY', KEYS[3], ARGV[1], 1)
end
local v = redis.call('HGET', KEYS[3], ARGV[1])
if v then return tonumber(v) end
return -1`;

/** KEYS[1] totals hash; ARGV = id1, total1, … — deletes fields still at the flushed value. */
const COMPARE_AND_DELETE_LUA = `
local n = 0
for i = 1, #ARGV, 2 do
  if redis.call('HGET', KEYS[1], ARGV[i]) == ARGV[i + 1] then
    redis.call('HDEL', KEYS[1], ARGV[i])
    n = n + 1
  end
end
return n`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Weight of a day `ageDays` old: 1 today, ½ after one half-life. */
export function decayWeight(ageDays: number): number {
  return 0.5 ** (ageDays / POPULARITY_HALF_LIFE_DAYS);
}

/**
 * Sums per-day view counts with exponential time decay. `days[i]` is the ZSET content of the day
 * `i` days ago, as ZRANGE … WITHSCORES output (flat [member, score, …]).
 */
export function decayedScores(days: readonly (readonly string[])[]): Map<string, number> {
  const scores = new Map<string, number>();
  days.forEach((flat, age) => {
    const w = decayWeight(age);
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const id = flat[i] as string;
      const views = Number(flat[i + 1]);
      if (!Number.isFinite(views) || views <= 0) continue;
      scores.set(id, (scores.get(id) ?? 0) + views * w);
    }
  });
  return scores;
}

/** "자주 찾는 단지": deduped view counting + time-decayed 30-day ranking. */
@Injectable()
export class ComplexPopularityService {
  private readonly logger = new Logger(ComplexPopularityService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: AppConfig,
    private readonly listings: ComplexListingsService,
  ) {}

  /** Stable per-viewer key: user/admin id, else a hash of IP + user agent (no raw PII in Redis). */
  viewerKey(principal: Principal | undefined): string {
    if (principal?.kind === 'USER') return `u:${principal.userId}`;
    if (principal?.kind === 'ADMIN') return `a:${principal.adminId}`;
    const ctx = RequestContext.current();
    const raw = `${ctx?.ip ?? ''}|${ctx?.userAgent ?? ''}`;
    return `x:${createHash('sha256').update(raw).digest('hex').slice(0, 24)}`;
  }

  /** Records a deduped view; returns the current total (falls back to `dbCount` on Redis errors). */
  async recordView(
    complexId: string,
    viewer: string,
    dbCount: number,
    now = new Date(),
  ): Promise<number> {
    const day = kstDayKey(now);
    try {
      const result = await this.redis.eval(
        RECORD_VIEW_LUA,
        3,
        COMPLEXES_REDIS_KEYS.viewSeen(complexId, viewer, day),
        COMPLEXES_REDIS_KEYS.viewsDaily(day),
        COMPLEXES_REDIS_KEYS.viewTotals,
        complexId,
        String(dbCount),
        String(VIEW_DEDUPE_TTL_SECONDS),
        String(VIEWS_DAILY_TTL_SECONDS),
      );
      const total = Number(result);
      return total >= 0 ? Math.max(total, dbCount) : dbCount;
    } catch (err) {
      this.logger.warn({ err, complexId }, 'complex view count failed');
      return dbCount;
    }
  }

  async popular(q: PopularComplexesQuery, now = new Date()): Promise<PopularComplexItem[]> {
    const version = await this.cache.version(COMPLEXES_CACHE.POPULAR);
    const key = `cache:complexes:popular:v${version}:${kstDayKey(now)}:${q.emdCode ?? '-'}:${q.limit}`;
    return this.cache.getOrSet(key, CACHE_TTL_SECONDS.POPULAR, () => this.computePopular(q, now));
  }

  /** Redis view totals → complexes.view_count (idempotent). Returns the number of rows flushed. */
  async flush(batchSize = 500): Promise<number> {
    let cursor = '0';
    let flushed = 0;
    do {
      const [next, flat] = await this.redis.hscan(
        COMPLEXES_REDIS_KEYS.viewTotals,
        cursor,
        'COUNT',
        batchSize,
      );
      cursor = next;
      const ids: string[] = [];
      const totals: number[] = [];
      const pairs: string[] = [];
      for (let i = 0; i + 1 < flat.length; i += 2) {
        const id = flat[i] as string;
        const value = flat[i + 1] as string;
        const total = Number(value);
        if (!UUID_RE.test(id) || !Number.isSafeInteger(total) || total < 0) continue;
        ids.push(id);
        totals.push(total);
        pairs.push(id, value);
      }
      if (ids.length === 0) continue;
      await this.prisma.$executeRaw`
        UPDATE complexes AS c SET view_count = GREATEST(c.view_count, v.total)
        FROM unnest(${ids}::uuid[], ${totals}::int[]) AS v(id, total)
        WHERE c.id = v.id`;
      await this.redis.eval(COMPARE_AND_DELETE_LUA, 1, COMPLEXES_REDIS_KEYS.viewTotals, ...pairs);
      flushed += ids.length;
    } while (cursor !== '0');
    return flushed;
  }

  private async windowScores(now: Date): Promise<Map<string, number>> {
    try {
      const pipeline = this.redis.pipeline();
      for (let age = 0; age < POPULARITY_WINDOW_DAYS; age++) {
        pipeline.zrange(
          COMPLEXES_REDIS_KEYS.viewsDaily(kstDayKey(new Date(now.getTime() - age * DAY_MS))),
          0,
          -1,
          'WITHSCORES',
        );
      }
      const results = (await pipeline.exec()) ?? [];
      return decayedScores(
        results.map(([err, value]) => (err || !Array.isArray(value) ? [] : (value as string[]))),
      );
    } catch (err) {
      this.logger.warn({ err }, 'popularity window read failed; falling back to totals');
      return new Map();
    }
  }

  private async computePopular(q: PopularComplexesQuery, now: Date): Promise<PopularComplexItem[]> {
    const where: Prisma.ComplexWhereInput = {
      deletedAt: null,
      sggCode: this.config.get('REGION_SGG_CODE'),
      ...(q.emdCode ? { emdCode: q.emdCode } : {}),
    };
    const scores = await this.windowScores(now);
    const scoredIds = [...scores.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 500)
      .map(([id]) => id);

    const scoredRows =
      scoredIds.length === 0
        ? []
        : await this.prisma.complex.findMany({
            where: { ...where, id: { in: scoredIds } },
            select: COMPLEX_SUMMARY_SELECT,
          });
    const byId = new Map(scoredRows.map((r) => [r.id, r]));
    const ranked = scoredIds.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
    const top = ranked.slice(0, q.limit);
    if (top.length < q.limit) {
      // Quiet period / fresh Redis: top up by all-time views, then favorites.
      const fill = await this.prisma.complex.findMany({
        where: { ...where, id: { notIn: top.map((r) => r.id) } },
        orderBy: [{ viewCount: 'desc' }, { favoriteCount: 'desc' }, { id: 'asc' }],
        take: q.limit - top.length,
        select: COMPLEX_SUMMARY_SELECT,
      });
      top.push(...fill);
    }
    const counts = await this.listings.countsFor(top.map((r) => r.id));
    return top.map((r, i) => ({
      ...toComplexSummary(r),
      rank: i + 1,
      score: Math.round((scores.get(r.id) ?? 0) * 100) / 100,
      listingCounts: counts.get(r.id) ?? {
        total: 0,
        byDealType: { SALE: 0, JEONSE: 0, MONTHLY: 0, PRESALE: 0 },
      },
    }));
  }
}
