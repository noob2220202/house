import { createHash } from 'node:crypto';
import { AssetType, enumValues, isBotUserAgent, kstDayKey } from '@house/shared';
import { Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import type { Principal } from '../../../common/auth/principal';
import { RequestContext } from '../../../common/context/request-context';
import { PrismaService } from '../../../prisma/prisma.service';
import { InjectRedis } from '../../../redis/redis.constants';
import {
  LISTINGS_REDIS_KEYS,
  REGION_VIEWS_DAILY_TTL_SECONDS,
  VIEW_DEDUPE_TTL_SECONDS,
} from '../constants';
import { regionKeyOf } from '../domain/region-key';

/**
 * KEYS[1] dedupe key, KEYS[2] totals hash, KEYS[3] region daily ZSET;
 * ARGV[1] listing id, ARGV[2] DB count, ARGV[3] TTL, ARGV[4] region member ('' = none),
 * ARGV[5] region ZSET TTL.
 * Counts once per viewer per window; the hash holds absolute totals (seeded from the DB count)
 * so the flush job can SET (GREATEST) rather than increment — re-running it is harmless. A counted
 * view also adds one to the listing's 지역 on today's region ZSET (home "많이 찾는 지역").
 */
const RECORD_VIEW_LUA = `
if redis.call('SET', KEYS[1], '1', 'NX', 'EX', tonumber(ARGV[3])) then
  if ARGV[4] ~= '' then
    redis.call('ZINCRBY', KEYS[3], 1, ARGV[4])
    redis.call('EXPIRE', KEYS[3], tonumber(ARGV[5]))
  end
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
const DAY_MS = 24 * 60 * 60 * 1000;
const ASSET_TYPES = new Set<string>(enumValues(AssetType));

/** What a listing view is attributed to in the region ranking. */
export interface ViewRegion {
  assetType: AssetType;
  emdCode: string | null;
}

/** regionKey → asset type → views. */
export type RegionViews = Map<string, Map<AssetType, number>>;

/** Region popularity counts users and anonymous visitors that are not bots — never admins. */
function countsForRegion(viewer: string): boolean {
  if (viewer.startsWith('u:')) return true;
  if (viewer.startsWith('a:')) return false;
  return !isBotUserAgent(RequestContext.current()?.userAgent);
}

export function regionViewMember(assetType: AssetType, regionKey: string): string {
  return `${assetType}|${regionKey}`;
}

export function parseRegionViewMember(
  member: string,
): { assetType: AssetType; regionKey: string } | null {
  const [assetType = '', regionKey = ''] = member.split('|');
  if (!ASSET_TYPES.has(assetType) || regionKeyOf(regionKey) !== regionKey) return null;
  return { assetType: assetType as AssetType, regionKey };
}

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

  /**
   * Records a (deduped) view and returns the current total; falls back to `dbCount` on Redis
   * errors. `region` (the listing's asset type + 법정동) feeds the per-region daily view ZSET
   * (signed-in users and anonymous non-bot visitors only).
   */
  async record(
    listingId: string,
    viewer: string,
    dbCount: number,
    region?: ViewRegion | null,
    now: Date = new Date(),
  ): Promise<number> {
    const key = region ? regionKeyOf(region.emdCode) : null;
    const member =
      key && region && countsForRegion(viewer) ? regionViewMember(region.assetType, key) : '';
    try {
      const result = await this.redis.eval(
        RECORD_VIEW_LUA,
        3,
        LISTINGS_REDIS_KEYS.viewSeen(listingId, viewer),
        LISTINGS_REDIS_KEYS.viewTotals,
        LISTINGS_REDIS_KEYS.regionViewsDaily(kstDayKey(now)),
        listingId,
        String(dbCount),
        String(VIEW_DEDUPE_TTL_SECONDS),
        member,
        String(REGION_VIEWS_DAILY_TTL_SECONDS),
      );
      const total = Number(result);
      return total >= 0 ? Math.max(total, dbCount) : dbCount;
    } catch (err) {
      this.logger.warn({ err, listingId }, 'view count failed');
      return dbCount;
    }
  }

  /** Current total without counting (Redis total, else `dbCount`; `dbCount` on Redis errors). */
  async current(listingId: string, dbCount: number): Promise<number> {
    try {
      const v = Number(await this.redis.hget(LISTINGS_REDIS_KEYS.viewTotals, listingId));
      return Number.isFinite(v) ? Math.max(v, dbCount) : dbCount;
    } catch (err) {
      this.logger.warn({ err, listingId }, 'view count read failed');
      return dbCount;
    }
  }

  /**
   * Counted listing views per (asset type, 지역) summed over the KST days `fromAge` … `toAge`
   * days ago (0 = today), e.g. (0, 6) = this week, (7, 13) = the week before. Empty on Redis errors.
   */
  async regionViews(fromAge: number, toAge: number, now: Date = new Date()): Promise<RegionViews> {
    const out: RegionViews = new Map();
    try {
      const pipeline = this.redis.pipeline();
      for (let age = fromAge; age <= toAge; age++) {
        pipeline.zrange(
          LISTINGS_REDIS_KEYS.regionViewsDaily(kstDayKey(new Date(now.getTime() - age * DAY_MS))),
          0,
          -1,
          'WITHSCORES',
        );
      }
      for (const [err, value] of (await pipeline.exec()) ?? []) {
        if (err || !Array.isArray(value)) continue;
        const flat = value as string[];
        for (let i = 0; i + 1 < flat.length; i += 2) {
          const parsed = parseRegionViewMember(flat[i] as string);
          const views = Number(flat[i + 1]);
          if (!parsed || !Number.isFinite(views) || views <= 0) continue;
          const byType = out.get(parsed.regionKey) ?? new Map<AssetType, number>();
          byType.set(parsed.assetType, (byType.get(parsed.assetType) ?? 0) + views);
          out.set(parsed.regionKey, byType);
        }
      }
    } catch (err) {
      this.logger.warn({ err }, 'region views read failed');
    }
    return out;
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
