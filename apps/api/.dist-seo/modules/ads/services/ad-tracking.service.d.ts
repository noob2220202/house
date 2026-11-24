import type Redis from 'ioredis';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
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
/**
 * Impression/click counting. Each (banner, KST day) has a Redis HyperLogLog of hashed visitor
 * ids, so a visitor counts once per banner per day and PFCOUNT *is* the counter (≈0.8% error,
 * at most ~12KB per key whatever clients send). A ZSET marks (day, banner) pairs touched since
 * the last flush; the flush writes PFCOUNT totals into banner_stat_daily (idempotent).
 */
export declare class AdTrackingService {
    private readonly prisma;
    private readonly serve;
    private readonly redis;
    private readonly logger;
    private readonly visitorKey;
    private readonly publicBase;
    constructor(prisma: PrismaService, serve: AdServeService, redis: Redis, config: AppConfig);
    /** Counts deduped impressions of live banners. Returns how many were newly counted. */
    recordImpressions(bannerIds: readonly string[], visitor: AdVisitor, now?: Date): Promise<number>;
    /**
     * Resolves the click redirect target (re-validating the stored URL: open-redirect safe) and
     * counts the click when the banner is live (servable), the client is not a bot and the request
     * is a top-level navigation (not an embedded `<img>`/fetch on someone else's page).
     */
    click(bannerId: string, visitor: AdVisitor, now?: Date): Promise<string>;
    /** Live (not yet flushed) counts for recent days, for the stats endpoint. */
    liveCounts(bannerId: string, dates: readonly string[]): Promise<Map<string, {
        impressions: number;
        clicks: number;
    }>>;
    /** Dates whose counters may still be in Redis (today and the retention window before it). */
    recentDates(now?: Date): string[];
    /**
     * Writes Redis totals for every (day, banner) touched before `now - grace` into
     * banner_stat_daily. GREATEST() keeps DB totals if Redis lost data (restart without
     * persistence). Safe to run concurrently or repeatedly.
     */
    flush(now?: Date): Promise<number>;
    private flushBatch;
    /** Returns how many counters changed (PFADD's approximation of "newly counted"). */
    private add;
    /** Null when the visitor cannot be identified (no session, no valid IP): not counted. */
    private visitorHash;
}
