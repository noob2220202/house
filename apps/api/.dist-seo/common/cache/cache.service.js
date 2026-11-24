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
var CacheService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const common_1 = require("@nestjs/common");
const redis_constants_1 = require("../../redis/redis.constants");
/**
 * Small JSON cache on the shared Redis client (keys get REDIS_KEY_PREFIX automatically).
 * Use namespaced keys: `cache:<module>:<what>:<params>`. Values must be JSON-serializable
 * (convert Decimal/Date first). Cache failures never fail the request.
 */
let CacheService = CacheService_1 = class CacheService {
    constructor(redis) {
        this.redis = redis;
        this.logger = new common_1.Logger(CacheService_1.name);
    }
    async get(key) {
        try {
            const raw = await this.redis.get(key);
            return raw === null ? undefined : JSON.parse(raw);
        }
        catch (err) {
            this.logger.warn({ err, key }, 'cache get failed');
            return undefined;
        }
    }
    async set(key, value, ttlSeconds) {
        try {
            await this.redis.set(key, JSON.stringify(value), 'EX', Math.max(1, Math.floor(ttlSeconds)));
        }
        catch (err) {
            this.logger.warn({ err, key }, 'cache set failed');
        }
    }
    /** Read-through: returns the cached value or computes, stores and returns it. */
    async getOrSet(key, ttlSeconds, compute) {
        const hit = await this.get(key);
        if (hit !== undefined)
            return hit;
        const value = await compute();
        await this.set(key, value, ttlSeconds);
        return value;
    }
    /**
     * Version-bump invalidation for a namespace: include `await cache.version('ads:serve')` in keys
     * and call `bump('ads:serve')` after writes; old keys simply expire.
     */
    async version(namespace) {
        try {
            return Number((await this.redis.get(`cache-version:${namespace}`)) ?? 0);
        }
        catch {
            return 0;
        }
    }
    async bump(namespace) {
        try {
            await this.redis.incr(`cache-version:${namespace}`);
        }
        catch (err) {
            this.logger.warn({ err, namespace }, 'cache bump failed');
        }
    }
};
exports.CacheService = CacheService;
exports.CacheService = CacheService = CacheService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS)),
    __metadata("design:paramtypes", [Function])
], CacheService);
//# sourceMappingURL=cache.service.js.map