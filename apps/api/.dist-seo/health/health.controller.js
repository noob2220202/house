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
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const public_decorator_1 = require("../common/decorators/public.decorator");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_constants_1 = require("../redis/redis.constants");
let HealthController = class HealthController {
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
    }
    /** Liveness: the process is up. */
    live() {
        return { status: 'ok', uptime: Math.round(process.uptime()) };
    }
    /** Readiness: DB and Redis reachable. 503 otherwise. */
    async ready(res) {
        const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);
        const ok = db === 'ok' && redis === 'ok';
        if (!ok)
            res.status(common_1.HttpStatus.SERVICE_UNAVAILABLE);
        return { status: ok ? 'ok' : 'error', checks: { db, redis } };
    }
    async checkDb() {
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            return 'ok';
        }
        catch {
            return 'error';
        }
    }
    async checkRedis() {
        try {
            return (await withTimeout(this.redis.ping(), 1000)) === 'PONG' ? 'ok' : 'error';
        }
        catch {
            return 'error';
        }
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], HealthController.prototype, "live", null);
__decorate([
    (0, common_1.Get)('ready'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "ready", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)('health'),
    (0, public_decorator_1.Public)(),
    (0, throttler_1.SkipThrottle)(),
    __param(1, (0, common_1.Inject)(redis_constants_1.REDIS)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Function])
], HealthController);
function withTimeout(p, ms) {
    return Promise.race([
        p,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms).unref()),
    ]);
}
//# sourceMappingURL=health.controller.js.map