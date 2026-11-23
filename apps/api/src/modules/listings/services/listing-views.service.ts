import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import type { Principal } from '../../../common/auth/principal';
import { RequestContext } from '../../../common/context/request-context';
import { PrismaService } from '../../../prisma/prisma.service';
import { InjectRedis } from '../../../redis/redis.constants';
import { LISTINGS_REDIS_KEYS, VIEW_DEDUPE_TTL_SECONDS } from '../constants';

/**
 * KEYS[1] dedupe key, KEYS[2] totals hash; ARGV[1] listing id, ARGV[2] DB count, ARGV[3] TTL.
 * Counts once per viewer per window; the hash holds absolute totals (seeded from the DB count)
 * so the flush job can SET (GREATEST) rather than increment — re-running it is harmless.
 */
const RECORD_VIEW_LUA = `
if redis.call('SET', KEYS[1], '1', 'NX', 'EX', tonumber(ARGV[3])) then
  redis.call('HSETNX', KEYS[2], ARGV[1], ARGV[2])
  return redis.call('HINCRBY', KEYS[2], ARGV[1], 1)
end
local v = redis.call('HGET', KEYS[2], ARGV[1])
if v then return tonumber(v) end
return -1`;

/** KEYS[1] totals hash; ARGV = id1, total1, id2, total2… — deletes fields still at the flushed value. */
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

@Injectable()
export class ListingViewsService {
  private readonly logger = new Logger(ListingViewsService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  /** Stable per-viewer key: the user id, else a hash of IP + user agent (no raw PII in Redis). */
  viewerKey(principal: Principal | undefined): string {
    if (principal?.kind === 'USER') return `u:${principal.userId}`;
    if (principal?.kind === 'ADMIN') return `a:${principal.adminId}`;
    const ctx = RequestContext.current();
    const raw = `${ctx?.ip ?? ''}|${ctx?.userAgent ?? ''}`;
    return `x:${createHash('sha256').update(raw).digest('hex').slice(0, 24)}`;
  }

  /** Records a (deduped) view and returns the current total; falls back to `dbCount` on Redis errors. */
  async record(listingId: string, viewer: string, dbCount: number): Promise<number> {
    try {
      const result = await this.redis.eval(
        RECORD_VIEW_LUA,
        2,
        LISTINGS_REDIS_KEYS.viewSeen(listingId, viewer),
        LISTINGS_REDIS_KEYS.viewTotals,
        listingId,
        String(dbCount),
        String(VIEW_DEDUPE_TTL_SECONDS),
      );
      const total = Number(result);
      return total >= 0 ? Math.max(total, dbCount) : dbCount;
    } catch (err) {
      this.logger.warn({ err, listingId }, 'view count failed');
      return dbCount;
    }
  }

  /** Writes Redis totals to listings.view_count (idempotent). Returns the number of listings flushed. */
  async flush(batchSize = 500): Promise<number> {
    let cursor = '0';
    let flushed = 0;
    do {
      const [next, flat] = await this.redis.hscan(
        LISTINGS_REDIS_KEYS.viewTotals,
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
        UPDATE listings AS l SET view_count = GREATEST(l.view_count, v.total)
        FROM unnest(${ids}::uuid[], ${totals}::int[]) AS v(id, total)
        WHERE l.id = v.id`;
      await this.redis.eval(COMPARE_AND_DELETE_LUA, 1, LISTINGS_REDIS_KEYS.viewTotals, ...pairs);
      flushed += ids.length;
    } while (cursor !== '0');
    return flushed;
  }
}
