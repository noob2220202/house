import { createHmac } from 'node:crypto';
import { addDays, ErrorCode, isBotUserAgent, kstDate, resolveAdLink } from '@house/shared';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type Redis from 'ioredis';
import { AppException } from '../../../common/errors/app.exception';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { InjectRedis } from '../../../redis/redis.constants';
import {
  ADS_COUNTER_RETENTION_DAYS,
  ADS_FLUSH_BATCH,
  ADS_FLUSH_GRACE_MS,
  ADS_REDIS,
} from '../constants';
import { anonymousIdentity, isTopLevelNavigation } from '../domain/visitor';
import { AdServeService } from './ad-serve.service';

/**
 * Who is looking at a banner: the session when logged in, otherwise the IP (IPv6: its /64).
 * The User-Agent only feeds the bot filter; Fetch Metadata only the click check.
 */
export interface AdVisitor {
  sessionId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  /** `Sec-Fetch-Dest` / `Sec-Fetch-Mode` request headers, when the browser sent them. */
  fetchDest?: string | null;
  fetchMode?: string | null;
}

const RETENTION_SECONDS = ADS_COUNTER_RETENTION_DAYS * 86_400;

/**
 * Impression/click counting. Each (banner, KST day) has a Redis HyperLogLog of hashed visitor
 * ids, so a visitor counts once per banner per day and PFCOUNT *is* the counter (≈0.8% error,
 * at most ~12KB per key whatever clients send). A ZSET marks (day, banner) pairs touched since
 * the last flush; the flush writes PFCOUNT totals into banner_stat_daily (idempotent).
 */
@Injectable()
export class AdTrackingService {
  private readonly logger = new Logger(AdTrackingService.name);
  private readonly visitorKey: Buffer;
  private readonly publicBase: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly serve: AdServeService,
    @InjectRedis() private readonly redis: Redis,
    config: AppConfig,
  ) {
    // Domain-separated key: visitor hashes cannot be linked to anything else derived from the secret.
    this.visitorKey = createHmac('sha256', config.get('COOKIE_SECRET'))
      .update('house:ads:visitor')
      .digest();
    this.publicBase = config.get('PUBLIC_BASE_URL');
  }

  /** Counts deduped impressions of live banners. Returns how many were newly counted. */
  async recordImpressions(
    bannerIds: readonly string[],
    visitor: AdVisitor,
    now: Date = new Date(),
  ): Promise<number> {
    if (bannerIds.length === 0 || isBotUserAgent(visitor.userAgent)) return 0;
    const member = this.visitorHash(kstDate(now), visitor);
    if (!member) return 0;
    const live = await this.serve.liveBannerIds(now);
    const ids = [...new Set(bannerIds)].filter((id) => live.has(id));
    if (ids.length === 0) return 0;
    return this.add(ADS_REDIS.impressions, ids, member, now);
  }

  /**
   * Resolves the click redirect target (re-validating the stored URL: open-redirect safe) and
   * counts the click when the banner is live (servable), the client is not a bot and the request
   * is a top-level navigation (not an embedded `<img>`/fetch on someone else's page).
   */
  async click(bannerId: string, visitor: AdVisitor, now: Date = new Date()): Promise<string> {
    const banner = await this.prisma.banner.findFirst({
      where: { id: bannerId, deletedAt: null },
      select: { id: true, linkUrl: true },
    });
    if (!banner?.linkUrl) throw AppException.notFound(ErrorCode.BANNER_NOT_FOUND);
    const target = resolveAdLink(banner.linkUrl, this.publicBase);
    if (!target) {
      this.logger.warn({ bannerId }, 'stored banner link failed validation');
      throw AppException.badRequest(ErrorCode.BANNER_INVALID_LINK);
    }
    const member = this.visitorHash(kstDate(now), visitor);
    if (
      member &&
      !isBotUserAgent(visitor.userAgent) &&
      isTopLevelNavigation(visitor.fetchDest, visitor.fetchMode)
    ) {
      try {
        if ((await this.serve.liveBannerIds(now)).has(banner.id)) {
          await this.add(ADS_REDIS.clicks, [banner.id], member, now);
        }
      } catch (err) {
        // Counting must never break the redirect.
        this.logger.warn({ err, bannerId }, 'click count failed');
      }
    }
    return target;
  }

  /** Live (not yet flushed) counts for recent days, for the stats endpoint. */
  async liveCounts(
    bannerId: string,
    dates: readonly string[],
  ): Promise<Map<string, { impressions: number; clicks: number }>> {
    const out = new Map<string, { impressions: number; clicks: number }>();
    if (dates.length === 0) return out;
    const pipe = this.redis.pipeline();
    for (const d of dates) {
      pipe.pfcount(ADS_REDIS.impressions(d, bannerId));
      pipe.pfcount(ADS_REDIS.clicks(d, bannerId));
    }
    const res = (await pipe.exec()) ?? [];
    dates.forEach((d, i) => {
      out.set(d, {
        impressions: Number(res[i * 2]?.[1] ?? 0),
        clicks: Number(res[i * 2 + 1]?.[1] ?? 0),
      });
    });
    return out;
  }

  /** Dates whose counters may still be in Redis (today and the retention window before it). */
  recentDates(now: Date = new Date()): string[] {
    const today = kstDate(now);
    return Array.from({ length: ADS_COUNTER_RETENTION_DAYS }, (_, i) => addDays(today, -i));
  }

  /**
   * Writes Redis totals for every (day, banner) touched before `now - grace` into
   * banner_stat_daily. GREATEST() keeps DB totals if Redis lost data (restart without
   * persistence). Safe to run concurrently or repeatedly.
   */
  async flush(now: Date = new Date()): Promise<number> {
    const cutoff = now.getTime() - ADS_FLUSH_GRACE_MS;
    // One snapshot read (pairs touched per interval are few): offset paging could skip entries
    // whose score moves past the cutoff while we iterate.
    const members = await this.redis.zrangebyscore(ADS_REDIS.DIRTY, '-inf', cutoff);
    let written = 0;
    for (let i = 0; i < members.length; i += ADS_FLUSH_BATCH) {
      written += await this.flushBatch(members.slice(i, i + ADS_FLUSH_BATCH));
    }
    await this.redis.zremrangebyscore(ADS_REDIS.DIRTY, '-inf', cutoff);
    return written;
  }

  private async flushBatch(members: readonly string[]): Promise<number> {
    const entries = members
      .map(parseDirtyMember)
      .filter((e): e is { date: string; bannerId: string } => e !== null);
    if (entries.length === 0) return 0;
    const pipe = this.redis.pipeline();
    for (const e of entries) {
      pipe.pfcount(ADS_REDIS.impressions(e.date, e.bannerId));
      pipe.pfcount(ADS_REDIS.clicks(e.date, e.bannerId));
    }
    const res = (await pipe.exec()) ?? [];
    const values = entries.map((e, i) => {
      const imp = Number(res[i * 2]?.[1] ?? 0);
      const clk = Number(res[i * 2 + 1]?.[1] ?? 0);
      return Prisma.sql`(${e.bannerId}::uuid, ${e.date}::date, ${imp}::int, ${clk}::int)`;
    });
    // JOIN drops ids of banners that no longer exist (FK) instead of failing the batch.
    return this.prisma.$executeRaw`
      INSERT INTO banner_stat_daily (banner_id, date, impressions, clicks, updated_at)
      SELECT v.banner_id, v.date, v.imp, v.clk, now()
      FROM (VALUES ${Prisma.join(values)}) AS v(banner_id, date, imp, clk)
      JOIN banners b ON b.id = v.banner_id
      ON CONFLICT (banner_id, date) DO UPDATE SET
        impressions = GREATEST(banner_stat_daily.impressions, EXCLUDED.impressions),
        clicks = GREATEST(banner_stat_daily.clicks, EXCLUDED.clicks),
        updated_at = now()`;
  }

  /** Returns how many counters changed (PFADD's approximation of "newly counted"). */
  private async add(
    keyOf: (date: string, bannerId: string) => string,
    ids: readonly string[],
    member: string,
    now: Date,
  ): Promise<number> {
    const date = kstDate(now);
    const pipe = this.redis.multi();
    for (const id of ids) {
      const key = keyOf(date, id);
      pipe.pfadd(key, member);
      pipe.expire(key, RETENTION_SECONDS);
      pipe.zadd(ADS_REDIS.DIRTY, now.getTime(), `${date}:${id}`);
    }
    const res = (await pipe.exec()) ?? [];
    let added = 0;
    for (let i = 0; i < ids.length; i++) added += Number(res[i * 3]?.[1] ?? 0);
    return added;
  }

  /** Null when the visitor cannot be identified (no session, no valid IP): not counted. */
  private visitorHash(date: string, v: AdVisitor): string | null {
    const identity = v.sessionId ? `s:${v.sessionId}` : anonymousIdentity(v.ip);
    if (!identity) return null;
    return createHmac('sha256', this.visitorKey)
      .update(`${date}|${identity}`)
      .digest('base64url')
      .slice(0, 22);
  }
}

const DIRTY_MEMBER = /^(\d{4}-\d{2}-\d{2}):([0-9a-f-]{36})$/;

function parseDirtyMember(m: string): { date: string; bannerId: string } | null {
  const match = DIRTY_MEMBER.exec(m);
  return match?.[1] && match[2] ? { date: match[1], bannerId: match[2] } : null;
}
