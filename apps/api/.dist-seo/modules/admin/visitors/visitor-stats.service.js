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
var VisitorStatsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisitorStatsService = void 0;
exports.deviceClassOf = deviceClassOf;
exports.visitorId = visitorId;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const daily_cap_service_1 = require("../../../common/throttle/daily-cap.service");
const redis_constants_1 = require("../../../redis/redis.constants");
const constants_1 = require("../constants");
/** Phones and tablets count as mobile (the web is mobile-first; tablets use the mobile layout). */
function deviceClassOf(userAgent) {
    return /Mobi|Android|iPhone|iPad|iPod|Mobile Safari|Opera Mini|IEMobile|SamsungBrowser/i.test(userAgent ?? '')
        ? 'mobile'
        : 'desktop';
}
const DAY_MS = 86_400_000;
/** A stable, non-reversible visitor id: the session when logged in, else ip + user agent. */
function visitorId(input) {
    const source = input.sessionToken
        ? `s:${input.sessionToken}`
        : `a:${input.ip ?? ''}|${input.userAgent ?? ''}`;
    return (0, node_crypto_1.createHash)('sha256').update(source).digest('base64url').slice(0, 22);
}
/** "YYYYMMDD" → "YYYY-MM-DD" */
function isoDay(key) {
    return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
}
/**
 * Unique daily visitors (KST days) in Redis HyperLogLogs: ~0.81% error, ≤12 KB per day, and the
 * sketch keeps no visitor ids (only register maxima), so nothing personal is stored.
 */
let VisitorStatsService = VisitorStatsService_1 = class VisitorStatsService {
    constructor(redis) {
        this.redis = redis;
        this.logger = new common_1.Logger(VisitorStatsService_1.name);
    }
    /**
     * One counted request: the visitor joins the day's HyperLogLog, and the day's request counter
     * (`pageViews` of the stats page — public API reads by visitors, a proxy for page views) and
     * device split are incremented.
     */
    async record(id, now = new Date(), device = 'desktop') {
        const day = (0, daily_cap_service_1.kstDateKey)(now);
        const key = `${constants_1.VISITOR_KEY_PREFIX}${day}`;
        const views = `${constants_1.PAGEVIEW_KEY_PREFIX}${day}`;
        const devices = `${constants_1.DEVICE_KEY_PREFIX}${day}`;
        await this.redis
            .multi()
            .pfadd(key, id)
            .expire(key, constants_1.VISITOR_KEY_TTL_SECONDS)
            .incr(views)
            .expire(views, constants_1.VISITOR_KEY_TTL_SECONDS)
            .hincrby(devices, device, 1)
            .expire(devices, constants_1.VISITOR_KEY_TTL_SECONDS)
            .exec();
    }
    /** Never awaited on the request path; a Redis hiccup must not fail page loads. */
    recordSafe(id, now = new Date(), device = 'desktop') {
        this.record(id, now, device).catch((err) => this.logger.warn({ err }, 'visitor counter update failed'));
    }
    /**
     * Per KST day for the last `days` days (oldest first): unique visitors, counted requests and
     * the mobile / desktop split of those requests.
     */
    async dailyTraffic(days, now = new Date()) {
        const keys = Array.from({ length: days }, (_, i) => (0, daily_cap_service_1.kstDateKey)(new Date(now.getTime() - (days - 1 - i) * DAY_MS)));
        const pipeline = this.redis.pipeline();
        for (const k of keys) {
            pipeline.pfcount(`${constants_1.VISITOR_KEY_PREFIX}${k}`);
            pipeline.get(`${constants_1.PAGEVIEW_KEY_PREFIX}${k}`);
            pipeline.hmget(`${constants_1.DEVICE_KEY_PREFIX}${k}`, 'mobile', 'desktop');
        }
        const results = (await pipeline.exec()) ?? [];
        const num = (v) => {
            const n = Number(v ?? 0);
            return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
        };
        return keys.map((k, i) => {
            const [vErr, visitors] = results[i * 3] ?? [];
            const [pErr, views] = results[i * 3 + 1] ?? [];
            const [dErr, split] = results[i * 3 + 2] ?? [];
            const [mobile, desktop] = dErr ? [0, 0] : (split ?? []).map(num);
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
    async lastDays(days, now = new Date()) {
        const keys = Array.from({ length: days }, (_, i) => (0, daily_cap_service_1.kstDateKey)(new Date(now.getTime() - (days - 1 - i) * DAY_MS)));
        const pipeline = this.redis.pipeline();
        for (const k of keys)
            pipeline.pfcount(`${constants_1.VISITOR_KEY_PREFIX}${k}`);
        pipeline.pfcount(...keys.map((k) => `${constants_1.VISITOR_KEY_PREFIX}${k}`));
        const results = (await pipeline.exec()) ?? [];
        const counts = results.map(([err, value]) => (err ? 0 : Number(value)));
        return {
            daily: keys.map((k, i) => ({ date: isoDay(k), count: counts[i] ?? 0 })),
            unique: counts[keys.length] ?? 0,
        };
    }
};
exports.VisitorStatsService = VisitorStatsService;
exports.VisitorStatsService = VisitorStatsService = VisitorStatsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, redis_constants_1.InjectRedis)()),
    __metadata("design:paramtypes", [Function])
], VisitorStatsService);
//# sourceMappingURL=visitor-stats.service.js.map