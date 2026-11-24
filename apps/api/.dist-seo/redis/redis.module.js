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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisModule = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
const app_config_service_1 = require("../config/app-config.service");
const redis_constants_1 = require("./redis.constants");
let RedisModule = class RedisModule {
    constructor(redis) {
        this.redis = redis;
    }
    async onApplicationShutdown() {
        if (this.redis.status !== 'end')
            await this.redis.quit().catch(() => undefined);
    }
};
exports.RedisModule = RedisModule;
exports.RedisModule = RedisModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            {
                provide: redis_constants_1.REDIS,
                inject: [app_config_service_1.AppConfig],
                useFactory: (config) => {
                    const logger = new common_1.Logger('Redis');
                    const client = new ioredis_1.default({
                        ...(0, redis_constants_1.redisOptionsFromUrl)(config.get('REDIS_URL')),
                        keyPrefix: config.get('REDIS_KEY_PREFIX'),
                        maxRetriesPerRequest: 3,
                        enableReadyCheck: true,
                    });
                    client.on('error', (err) => logger.error(`redis error: ${err.message}`));
                    return client;
                },
            },
        ],
        exports: [redis_constants_1.REDIS],
    }),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS)),
    __metadata("design:paramtypes", [ioredis_1.default])
], RedisModule);
//# sourceMappingURL=redis.module.js.map