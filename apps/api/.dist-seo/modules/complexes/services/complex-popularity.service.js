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
var ComplexPopularityService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplexPopularityService = void 0;
exports.networkPrefix = networkPrefix;
exports.decayWeight = decayWeight;
exports.decayedScores = decayedScores;
const node_crypto_1 = require("node:crypto");
const node_net_1 = require("node:net");
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const cache_service_1 = require("../../../common/cache/cache.service");
const request_context_1 = require("../../../common/context/request-context");
const app_config_service_1 = require("../../../config/app-config.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const redis_constants_1 = require("../../../redis/redis.constants");
const complex_mapper_1 = require("../complex.mapper");
const constants_1 = require("../constants");
const complex_listings_service_1 = require("./complex-listings.service");
/**
 * KEYS: seen marker, daily ZSET, totals HASH, per-network daily cap counter;
 * ARGV: id, DB count, dedupe TTL, daily TTL, cap (0 = none), cap TTL.
 * One counted view per viewer per KST day; anonymous networks additionally stop counting after
 * `cap` distinct 단지 a day. The totals hash holds absolute totals seeded from the DB so the
 * flush can SET GREATEST(...) and re-running it is harmless.
 */
const RECORD_VIEW_LUA = `
local function total()
  local v = redis.call('HGET', KEYS[3], ARGV[1])
  if v then return tonumber(v) end
  return -1
end
if not redis.call('SET', KEYS[1], '1', 'NX', 'EX', tonumber(ARGV[3])) then return total() end
local cap = tonumber(ARGV[5])
if cap > 0 then
  local n = redis.call('INCR', KEYS[4])
  if n == 1 then redis.call('EXPIRE', KEYS[4], tonumber(ARGV[6])) end
  if n > cap then return total() end
end
redis.call('ZINCRBY', KEYS[2], 1, ARGV[1])
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[4]))
redis.call('HSETNX', KEYS[3], ARGV[1], ARGV[2])
return redis.call('HINCRBY', KEYS[3], ARGV[1], 1)`;
/**
 * Network a client address belongs to: IPv4 /24, IPv6 /64 (IPv4-mapped IPv6 is treated as IPv4).
 * Rotating addresses inside a home/office network or rotating the User-Agent gains nothing.
 */
function networkPrefix(ip) {
    if (!ip)
        return null;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)?.[1];
    const v4 = mapped ?? ip;
    if ((0, node_net_1.isIP)(v4) === 4)
        return `${v4.split('.').slice(0, 3).join('.')}.0/24`;
    const addr = (ip.split('%')[0] ?? '').toLowerCase();
    if ((0, node_net_1.isIP)(addr) !== 6 || addr.includes('.'))
        return null;
    const [head = '', tail = ''] = addr.split('::');
    const h = head ? head.split(':') : [];
    const t = addr.includes('::') && tail ? tail.split(':') : [];
    const groups = [...h, ...new Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
    return `${groups
        .slice(0, 4)
        .map((g) => g.replace(/^0+(?=.)/, ''))
        .join(':')}::/64`;
}
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
function decayWeight(ageDays) {
    return 0.5 ** (ageDays / constants_1.POPULARITY_HALF_LIFE_DAYS);
}
/**
 * Sums per-day view counts with exponential time decay. `days[i]` is the ZSET content of the day
 * `i` days ago, as ZRANGE … WITHSCORES output (flat [member, score, …]).
 */
function decayedScores(days) {
    const scores = new Map();
    days.forEach((flat, age) => {
        const w = decayWeight(age);
        for (let i = 0; i + 1 < flat.length; i += 2) {
            const id = flat[i];
            const views = Number(flat[i + 1]);
            if (!Number.isFinite(views) || views <= 0)
                continue;
            scores.set(id, (scores.get(id) ?? 0) + views * w);
        }
    });
    return scores;
}
/** "자주 찾는 단지": deduped view counting + time-decayed 30-day ranking. */
let ComplexPopularityService = ComplexPopularityService_1 = class ComplexPopularityService {
    constructor(redis, prisma, cache, config, listings) {
        this.redis = redis;
        this.prisma = prisma;
        this.cache = cache;
        this.config = config;
        this.listings = listings;
        this.logger = new common_1.Logger(ComplexPopularityService_1.name);
        // Purpose-bound subkey so the cookie secret itself is never used as an HMAC key elsewhere.
        this.viewerSecret = (0, node_crypto_1.createHmac)('sha256', config.get('COOKIE_SECRET'))
            .update('complexes:viewer-key')
            .digest();
    }
    /**
     * Per-viewer key: user id, else an HMAC (server secret) of the client's network — never raw or
     * reversible PII in Redis. Admins, bots and requests without an address are not counted.
     */
    viewerKey(principal) {
        if (principal?.kind === 'USER')
            return { key: `u:${principal.userId}`, anonymous: false };
        if (principal?.kind === 'ADMIN')
            return null;
        const ctx = request_context_1.RequestContext.current();
        if ((0, shared_1.isBotUserAgent)(ctx?.userAgent))
            return null;
        const network = networkPrefix(ctx?.ip);
        if (!network)
            return null;
        const digest = (0, node_crypto_1.createHmac)('sha256', this.viewerSecret).update(network).digest('base64url');
        return { key: `n:${digest.slice(0, 22)}`, anonymous: true };
    }
    /** Records a deduped view; returns the current total (falls back to `dbCount` on Redis errors). */
    async recordView(complexId, viewer, dbCount, now = new Date()) {
        const day = (0, shared_1.kstDayKey)(now);
        try {
            if (!viewer) {
                const v = await this.redis.hget(constants_1.COMPLEXES_REDIS_KEYS.viewTotals, complexId);
                return Math.max(Number(v ?? 0) || 0, dbCount);
            }
            const seen = constants_1.COMPLEXES_REDIS_KEYS.viewSeen(complexId, viewer.key, day);
            const result = await this.redis.eval(RECORD_VIEW_LUA, 4, seen, constants_1.COMPLEXES_REDIS_KEYS.viewsDaily(day), constants_1.COMPLEXES_REDIS_KEYS.viewTotals, viewer.anonymous ? constants_1.COMPLEXES_REDIS_KEYS.viewNetworkCap(viewer.key, day) : seen, complexId, String(dbCount), String(constants_1.VIEW_DEDUPE_TTL_SECONDS), String(constants_1.VIEWS_DAILY_TTL_SECONDS), String(viewer.anonymous ? constants_1.ANON_VIEW_DAILY_CAP_PER_NETWORK : 0), String(constants_1.VIEW_DEDUPE_TTL_SECONDS));
            const total = Number(result);
            return total >= 0 ? Math.max(total, dbCount) : dbCount;
        }
        catch (err) {
            this.logger.warn({ err, complexId }, 'complex view count failed');
            return dbCount;
        }
    }
    async popular(q, now = new Date()) {
        const version = await this.cache.version(constants_1.COMPLEXES_CACHE.POPULAR);
        const key = `cache:complexes:popular:v${version}:${(0, shared_1.kstDayKey)(now)}:${q.emdCode ?? '-'}:${q.limit}`;
        return this.cache.getOrSet(key, constants_1.CACHE_TTL_SECONDS.POPULAR, () => this.computePopular(q, now));
    }
    /** Redis view totals → complexes.view_count (idempotent). Returns the number of rows flushed. */
    async flush(batchSize = 500) {
        let cursor = '0';
        let flushed = 0;
        do {
            const [next, flat] = await this.redis.hscan(constants_1.COMPLEXES_REDIS_KEYS.viewTotals, cursor, 'COUNT', batchSize);
            cursor = next;
            const ids = [];
            const totals = [];
            const pairs = [];
            for (let i = 0; i + 1 < flat.length; i += 2) {
                const id = flat[i];
                const value = flat[i + 1];
                const total = Number(value);
                if (!UUID_RE.test(id) || !Number.isSafeInteger(total) || total < 0)
                    continue;
                ids.push(id);
                totals.push(total);
                pairs.push(id, value);
            }
            if (ids.length === 0)
                continue;
            await this.prisma.$executeRaw `
        UPDATE complexes AS c SET view_count = GREATEST(c.view_count, v.total)
        FROM unnest(${ids}::uuid[], ${totals}::int[]) AS v(id, total)
        WHERE c.id = v.id`;
            await this.redis.eval(COMPARE_AND_DELETE_LUA, 1, constants_1.COMPLEXES_REDIS_KEYS.viewTotals, ...pairs);
            flushed += ids.length;
        } while (cursor !== '0');
        return flushed;
    }
    async windowScores(now) {
        try {
            const pipeline = this.redis.pipeline();
            for (let age = 0; age < constants_1.POPULARITY_WINDOW_DAYS; age++) {
                pipeline.zrange(constants_1.COMPLEXES_REDIS_KEYS.viewsDaily((0, shared_1.kstDayKey)(new Date(now.getTime() - age * DAY_MS))), 0, -1, 'WITHSCORES');
            }
            const results = (await pipeline.exec()) ?? [];
            return decayedScores(results.map(([err, value]) => (err || !Array.isArray(value) ? [] : value)));
        }
        catch (err) {
            this.logger.warn({ err }, 'popularity window read failed; falling back to totals');
            return new Map();
        }
    }
    async computePopular(q, now) {
        const where = {
            deletedAt: null,
            sggCode: this.config.get('REGION_SGG_CODE'),
            ...(q.emdCode ? { emdCode: q.emdCode } : {}),
        };
        const scores = await this.windowScores(now);
        const scoredIds = [...scores.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, 500)
            .map(([id]) => id);
        const scoredRows = scoredIds.length === 0
            ? []
            : await this.prisma.complex.findMany({
                where: { ...where, id: { in: scoredIds } },
                select: complex_mapper_1.COMPLEX_SUMMARY_SELECT,
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
                select: complex_mapper_1.COMPLEX_SUMMARY_SELECT,
            });
            top.push(...fill);
        }
        const counts = await this.listings.countsFor(top.map((r) => r.id));
        return top.map((r, i) => ({
            ...(0, complex_mapper_1.toComplexSummary)(r),
            rank: i + 1,
            score: Math.round((scores.get(r.id) ?? 0) * 100) / 100,
            listingCounts: counts.get(r.id) ?? {
                total: 0,
                byDealType: { SALE: 0, JEONSE: 0, MONTHLY: 0, PRESALE: 0 },
            },
        }));
    }
};
exports.ComplexPopularityService = ComplexPopularityService;
exports.ComplexPopularityService = ComplexPopularityService = ComplexPopularityService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, redis_constants_1.InjectRedis)()),
    __metadata("design:paramtypes", [Function, prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        app_config_service_1.AppConfig,
        complex_listings_service_1.ComplexListingsService])
], ComplexPopularityService);
//# sourceMappingURL=complex-popularity.service.js.map