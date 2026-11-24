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
var ListingViewsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingViewsService = void 0;
exports.regionViewMember = regionViewMember;
exports.parseRegionViewMember = parseRegionViewMember;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const request_context_1 = require("../../../common/context/request-context");
const prisma_service_1 = require("../../../prisma/prisma.service");
const redis_constants_1 = require("../../../redis/redis.constants");
const constants_1 = require("../constants");
const region_key_1 = require("../domain/region-key");
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
const ASSET_TYPES = new Set((0, shared_1.enumValues)(shared_1.AssetType));
/** Region popularity counts users and anonymous visitors that are not bots — never admins. */
function countsForRegion(viewer) {
    if (viewer.startsWith('u:'))
        return true;
    if (viewer.startsWith('a:'))
        return false;
    return !(0, shared_1.isBotUserAgent)(request_context_1.RequestContext.current()?.userAgent);
}
function regionViewMember(assetType, regionKey) {
    return `${assetType}|${regionKey}`;
}
function parseRegionViewMember(member) {
    const [assetType = '', regionKey = ''] = member.split('|');
    if (!ASSET_TYPES.has(assetType) || (0, region_key_1.regionKeyOf)(regionKey) !== regionKey)
        return null;
    return { assetType: assetType, regionKey };
}
let ListingViewsService = ListingViewsService_1 = class ListingViewsService {
    constructor(redis, prisma) {
        this.redis = redis;
        this.prisma = prisma;
        this.logger = new common_1.Logger(ListingViewsService_1.name);
    }
    /** Stable per-viewer key: the user id, else a hash of IP + user agent (no raw PII in Redis). */
    viewerKey(principal) {
        if (principal?.kind === 'USER')
            return `u:${principal.userId}`;
        if (principal?.kind === 'ADMIN')
            return `a:${principal.adminId}`;
        const ctx = request_context_1.RequestContext.current();
        const raw = `${ctx?.ip ?? ''}|${ctx?.userAgent ?? ''}`;
        return `x:${(0, node_crypto_1.createHash)('sha256').update(raw).digest('hex').slice(0, 24)}`;
    }
    /**
     * Records a (deduped) view and returns the current total; falls back to `dbCount` on Redis
     * errors. `region` (the listing's asset type + 법정동) feeds the per-region daily view ZSET
     * (signed-in users and anonymous non-bot visitors only).
     */
    async record(listingId, viewer, dbCount, region, now = new Date()) {
        const key = region ? (0, region_key_1.regionKeyOf)(region.emdCode) : null;
        const member = key && region && countsForRegion(viewer) ? regionViewMember(region.assetType, key) : '';
        try {
            const result = await this.redis.eval(RECORD_VIEW_LUA, 3, constants_1.LISTINGS_REDIS_KEYS.viewSeen(listingId, viewer), constants_1.LISTINGS_REDIS_KEYS.viewTotals, constants_1.LISTINGS_REDIS_KEYS.regionViewsDaily((0, shared_1.kstDayKey)(now)), listingId, String(dbCount), String(constants_1.VIEW_DEDUPE_TTL_SECONDS), member, String(constants_1.REGION_VIEWS_DAILY_TTL_SECONDS));
            const total = Number(result);
            return total >= 0 ? Math.max(total, dbCount) : dbCount;
        }
        catch (err) {
            this.logger.warn({ err, listingId }, 'view count failed');
            return dbCount;
        }
    }
    /**
     * Counted listing views per (asset type, 지역) summed over the KST days `fromAge` … `toAge`
     * days ago (0 = today), e.g. (0, 6) = this week, (7, 13) = the week before. Empty on Redis errors.
     */
    async regionViews(fromAge, toAge, now = new Date()) {
        const out = new Map();
        try {
            const pipeline = this.redis.pipeline();
            for (let age = fromAge; age <= toAge; age++) {
                pipeline.zrange(constants_1.LISTINGS_REDIS_KEYS.regionViewsDaily((0, shared_1.kstDayKey)(new Date(now.getTime() - age * DAY_MS))), 0, -1, 'WITHSCORES');
            }
            for (const [err, value] of (await pipeline.exec()) ?? []) {
                if (err || !Array.isArray(value))
                    continue;
                const flat = value;
                for (let i = 0; i + 1 < flat.length; i += 2) {
                    const parsed = parseRegionViewMember(flat[i]);
                    const views = Number(flat[i + 1]);
                    if (!parsed || !Number.isFinite(views) || views <= 0)
                        continue;
                    const byType = out.get(parsed.regionKey) ?? new Map();
                    byType.set(parsed.assetType, (byType.get(parsed.assetType) ?? 0) + views);
                    out.set(parsed.regionKey, byType);
                }
            }
        }
        catch (err) {
            this.logger.warn({ err }, 'region views read failed');
        }
        return out;
    }
    /** Writes Redis totals to listings.view_count (idempotent). Returns the number of listings flushed. */
    async flush(batchSize = 500) {
        let cursor = '0';
        let flushed = 0;
        do {
            const [next, flat] = await this.redis.hscan(constants_1.LISTINGS_REDIS_KEYS.viewTotals, cursor, 'COUNT', batchSize);
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
        UPDATE listings AS l SET view_count = GREATEST(l.view_count, v.total)
        FROM unnest(${ids}::uuid[], ${totals}::int[]) AS v(id, total)
        WHERE l.id = v.id`;
            await this.redis.eval(COMPARE_AND_DELETE_LUA, 1, constants_1.LISTINGS_REDIS_KEYS.viewTotals, ...pairs);
            flushed += ids.length;
        } while (cursor !== '0');
        return flushed;
    }
};
exports.ListingViewsService = ListingViewsService;
exports.ListingViewsService = ListingViewsService = ListingViewsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, redis_constants_1.InjectRedis)()),
    __metadata("design:paramtypes", [Function, prisma_service_1.PrismaService])
], ListingViewsService);
//# sourceMappingURL=listing-views.service.js.map