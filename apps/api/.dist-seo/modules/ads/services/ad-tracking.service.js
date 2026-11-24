"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AdTrackingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdTrackingService = void 0;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const app_exception_1 = require("../../../common/errors/app.exception");
const app_config_service_1 = require("../../../config/app-config.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const redis_constants_1 = require("../../../redis/redis.constants");
const constants_1 = require("../constants");
const visitor_1 = require("../domain/visitor");
const ad_serve_service_1 = require("./ad-serve.service");
const RETENTION_SECONDS = constants_1.ADS_COUNTER_RETENTION_DAYS * 86_400;
/**
 * Impression/click counting. Each (banner, KST day) has a Redis HyperLogLog of hashed visitor
 * ids, so a visitor counts once per banner per day and PFCOUNT *is* the counter (≈0.8% error,
 * at most ~12KB per key whatever clients send). A ZSET marks (day, banner) pairs touched since
 * the last flush; the flush writes PFCOUNT totals into banner_stat_daily (idempotent).
 */
let AdTrackingService = AdTrackingService_1 = class AdTrackingService {
    constructor(prisma, serve, redis, config) {
        this.prisma = prisma;
        this.serve = serve;
        this.redis = redis;
        this.logger = new common_1.Logger(AdTrackingService_1.name);
        // Domain-separated key: visitor hashes cannot be linked to anything else derived from the secret.
        this.visitorKey = (0, node_crypto_1.createHmac)('sha256', config.get('COOKIE_SECRET'))
            .update('house:ads:visitor')
            .digest();
        this.publicBase = config.get('PUBLIC_BASE_URL');
    }
    /** Counts deduped impressions of live banners. Returns how many were newly counted. */
    async recordImpressions(bannerIds, visitor, now = new Date()) {
        if (bannerIds.length === 0 || (0, shared_1.isBotUserAgent)(visitor.userAgent))
            return 0;
        const member = this.visitorHash((0, shared_1.kstDate)(now), visitor);
        if (!member)
            return 0;
        const live = await this.serve.liveBannerIds(now);
        const ids = [...new Set(bannerIds)].filter((id) => live.has(id));
        if (ids.length === 0)
            return 0;
        return this.add(constants_1.ADS_REDIS.impressions, ids, member, now);
    }
    /**
     * Resolves the click redirect target (re-validating the stored URL: open-redirect safe) and
     * counts the click when the banner is live (servable), the client is not a bot and the request
     * is a top-level navigation (not an embedded `<img>`/fetch on someone else's page).
     */
    async click(bannerId, visitor, now = new Date()) {
        const banner = await this.prisma.banner.findFirst({
            where: { id: bannerId, deletedAt: null },
            select: { id: true, linkUrl: true },
        });
        if (!banner?.linkUrl)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.BANNER_NOT_FOUND);
        const target = (0, shared_1.resolveAdLink)(banner.linkUrl, this.publicBase);
        if (!target) {
            this.logger.warn({ bannerId }, 'stored banner link failed validation');
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.BANNER_INVALID_LINK);
        }
        const member = this.visitorHash((0, shared_1.kstDate)(now), visitor);
        if (member &&
            !(0, shared_1.isBotUserAgent)(visitor.userAgent) &&
            (0, visitor_1.isTopLevelNavigation)(visitor.fetchDest, visitor.fetchMode)) {
            try {
                if ((await this.serve.liveBannerIds(now)).has(banner.id)) {
                    await this.add(constants_1.ADS_REDIS.clicks, [banner.id], member, now);
                }
            }
            catch (err) {
                // Counting must never break the redirect.
                this.logger.warn({ err, bannerId }, 'click count failed');
            }
        }
        return target;
    }
    /** Live (not yet flushed) counts for recent days, for the stats endpoint. */
    async liveCounts(bannerId, dates) {
        const out = new Map();
        if (dates.length === 0)
            return out;
        const pipe = this.redis.pipeline();
        for (const d of dates) {
            pipe.pfcount(constants_1.ADS_REDIS.impressions(d, bannerId));
            pipe.pfcount(constants_1.ADS_REDIS.clicks(d, bannerId));
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
    recentDates(now = new Date()) {
        const today = (0, shared_1.kstDate)(now);
        return Array.from({ length: constants_1.ADS_COUNTER_RETENTION_DAYS }, (_, i) => (0, shared_1.addDays)(today, -i));
    }
    /**
     * Writes Redis totals for every (day, banner) touched before `now - grace` into
     * banner_stat_daily. GREATEST() keeps DB totals if Redis lost data (restart without
     * persistence). Safe to run concurrently or repeatedly.
     */
    async flush(now = new Date()) {
        const cutoff = now.getTime() - constants_1.ADS_FLUSH_GRACE_MS;
        // One snapshot read (pairs touched per interval are few): offset paging could skip entries
        // whose score moves past the cutoff while we iterate.
        const members = await this.redis.zrangebyscore(constants_1.ADS_REDIS.DIRTY, '-inf', cutoff);
        let written = 0;
        for (let i = 0; i < members.length; i += constants_1.ADS_FLUSH_BATCH) {
            written += await this.flushBatch(members.slice(i, i + constants_1.ADS_FLUSH_BATCH));
        }
        await this.redis.zremrangebyscore(constants_1.ADS_REDIS.DIRTY, '-inf', cutoff);
        return written;
    }
    async flushBatch(members) {
        const entries = members
            .map(parseDirtyMember)
            .filter((e) => e !== null);
        if (entries.length === 0)
            return 0;
        const pipe = this.redis.pipeline();
        for (const e of entries) {
            pipe.pfcount(constants_1.ADS_REDIS.impressions(e.date, e.bannerId));
            pipe.pfcount(constants_1.ADS_REDIS.clicks(e.date, e.bannerId));
        }
        const res = (await pipe.exec()) ?? [];
        const values = entries.map((e, i) => {
            const imp = Number(res[i * 2]?.[1] ?? 0);
            const clk = Number(res[i * 2 + 1]?.[1] ?? 0);
            return client_1.Prisma.sql `(${e.bannerId}::uuid, ${e.date}::date, ${imp}::int, ${clk}::int)`;
        });
        // JOIN drops ids of banners that no longer exist (FK) instead of failing the batch.
        return this.prisma.$executeRaw `
      INSERT INTO banner_stat_daily (banner_id, date, impressions, clicks, updated_at)
      SELECT v.banner_id, v.date, v.imp, v.clk, now()
      FROM (VALUES ${client_1.Prisma.join(values)}) AS v(banner_id, date, imp, clk)
      JOIN banners b ON b.id = v.banner_id
      ON CONFLICT (banner_id, date) DO UPDATE SET
        impressions = GREATEST(banner_stat_daily.impressions, EXCLUDED.impressions),
        clicks = GREATEST(banner_stat_daily.clicks, EXCLUDED.clicks),
        updated_at = now()`;
    }
    /** Returns how many counters changed (PFADD's approximation of "newly counted"). */
    async add(keyOf, ids, member, now) {
        const date = (0, shared_1.kstDate)(now);
        const pipe = this.redis.multi();
        for (const id of ids) {
            const key = keyOf(date, id);
            pipe.pfadd(key, member);
            pipe.expire(key, RETENTION_SECONDS);
            pipe.zadd(constants_1.ADS_REDIS.DIRTY, now.getTime(), `${date}:${id}`);
        }
        const res = (await pipe.exec()) ?? [];
        let added = 0;
        for (let i = 0; i < ids.length; i++)
            added += Number(res[i * 3]?.[1] ?? 0);
        return added;
    }
    /** Null when the visitor cannot be identified (no session, no valid IP): not counted. */
    visitorHash(date, v) {
        const identity = v.sessionId ? `s:${v.sessionId}` : (0, visitor_1.anonymousIdentity)(v.ip);
        if (!identity)
            return null;
        return (0, node_crypto_1.createHmac)('sha256', this.visitorKey)
            .update(`${date}|${identity}`)
            .digest('base64url')
            .slice(0, 22);
    }
};
exports.AdTrackingService = AdTrackingService;
exports.AdTrackingService = AdTrackingService = AdTrackingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, redis_constants_1.InjectRedis)()),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ad_serve_service_1.AdServeService, Function, app_config_service_1.AppConfig])
], AdTrackingService);
const DIRTY_MEMBER = /^(\d{4}-\d{2}-\d{2}):([0-9a-f-]{36})$/;
function parseDirtyMember(m) {
    const match = DIRTY_MEMBER.exec(m);
    return match?.[1] && match[2] ? { date: match[1], bannerId: match[2] } : null;
}
//# sourceMappingURL=ad-tracking.service.js.map