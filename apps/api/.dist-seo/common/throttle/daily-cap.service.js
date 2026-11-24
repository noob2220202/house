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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyCapService = void 0;
exports.kstDateKey = kstDateKey;
exports.secondsUntilKstMidnight = secondsUntilKstMidnight;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const redis_constants_1 = require("../../redis/redis.constants");
const app_exception_1 = require("../errors/app.exception");
const throttle_constants_1 = require("./throttle.constants");
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
/** "YYYYMMDD" of the current day in Asia/Seoul. */
function kstDateKey(now = new Date()) {
    return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10).replace(/-/g, '');
}
/** Seconds until the next KST midnight (min 1). */
function secondsUntilKstMidnight(now = new Date()) {
    const kst = now.getTime() + KST_OFFSET_MS;
    const nextMidnight = Math.floor(kst / 86_400_000 + 1) * 86_400_000;
    return Math.max(1, Math.ceil((nextMidnight - kst) / 1000));
}
/**
 * Per-user daily caps backed by Redis counters (reset at KST midnight).
 *   await this.caps.consume('DEAL_REQUEST_CREATE', user.userId); // throws 429 RATE_LIMITED when over
 * Call it right before the write; it counts the attempt even if the write later fails, which is the
 * conservative choice for abuse control.
 */
let DailyCapService = class DailyCapService {
    constructor(redis) {
        this.redis = redis;
    }
    async consume(key, subjectId, now = new Date()) {
        const redisKey = `cap:${key}:${kstDateKey(now)}:${subjectId}`;
        const results = await this.redis
            .multi()
            .incr(redisKey)
            .expire(redisKey, secondsUntilKstMidnight(now) + 60)
            .exec();
        const count = Number(results?.[0]?.[1] ?? 0);
        if (count > throttle_constants_1.DAILY_CAPS[key]) {
            throw new app_exception_1.AppException(shared_1.ErrorCode.RATE_LIMITED, {
                details: { cap: key, limit: throttle_constants_1.DAILY_CAPS[key] },
            });
        }
        return count;
    }
    async used(key, subjectId, now = new Date()) {
        return Number((await this.redis.get(`cap:${key}:${kstDateKey(now)}:${subjectId}`)) ?? 0);
    }
};
exports.DailyCapService = DailyCapService;
exports.DailyCapService = DailyCapService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS)),
    __metadata("design:paramtypes", [Function])
], DailyCapService);
//# sourceMappingURL=daily-cap.service.js.map