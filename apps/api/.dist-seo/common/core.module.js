"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const throttler_1 = require("@nestjs/throttler");
const app_config_service_1 = require("../config/app-config.service");
const redis_constants_1 = require("../redis/redis.constants");
const audit_interceptor_1 = require("./audit/audit.interceptor");
const audit_module_1 = require("./audit/audit.module");
const auth_guard_1 = require("./auth/auth.guard");
const cache_service_1 = require("./cache/cache.service");
const csrf_guard_1 = require("./auth/csrf.guard");
const all_exceptions_filter_1 = require("./filters/all-exceptions.filter");
const zod_validation_pipe_1 = require("./pipes/zod-validation.pipe");
const daily_cap_service_1 = require("./throttle/daily-cap.service");
const house_throttler_guard_1 = require("./throttle/house-throttler.guard");
const redis_throttler_storage_1 = require("./throttle/redis-throttler.storage");
/**
 * Cross-cutting wiring. Guard order matters: Throttler (per user, else per IP) → Auth (reuses the
 * memoized session) → CSRF.
 * Nothing here should need editing by module teams.
 */
let CoreModule = class CoreModule {
};
exports.CoreModule = CoreModule;
exports.CoreModule = CoreModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            audit_module_1.AuditModule,
            throttler_1.ThrottlerModule.forRootAsync({
                inject: [app_config_service_1.AppConfig, redis_constants_1.REDIS],
                useFactory: (config, redis) => ({
                    throttlers: [
                        {
                            name: 'default',
                            ttl: config.get('THROTTLE_TTL_MS'),
                            limit: config.get('THROTTLE_LIMIT'),
                        },
                    ],
                    storage: new redis_throttler_storage_1.RedisThrottlerStorage(redis),
                }),
            }),
        ],
        providers: [
            { provide: core_1.APP_GUARD, useClass: house_throttler_guard_1.HouseThrottlerGuard },
            { provide: core_1.APP_GUARD, useClass: auth_guard_1.AuthGuard },
            { provide: core_1.APP_GUARD, useClass: csrf_guard_1.CsrfGuard },
            { provide: core_1.APP_PIPE, useFactory: () => new zod_validation_pipe_1.ZodValidationPipe() },
            { provide: core_1.APP_FILTER, useClass: all_exceptions_filter_1.AllExceptionsFilter },
            { provide: core_1.APP_INTERCEPTOR, useClass: audit_interceptor_1.AuditInterceptor },
            cache_service_1.CacheService,
            daily_cap_service_1.DailyCapService,
        ],
        exports: [audit_module_1.AuditModule, cache_service_1.CacheService, daily_cap_service_1.DailyCapService],
    })
], CoreModule);
//# sourceMappingURL=core.module.js.map