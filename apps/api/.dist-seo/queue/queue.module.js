"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const app_config_service_1 = require("../config/app-config.service");
const redis_constants_1 = require("../redis/redis.constants");
/**
 * BullMQ root connection. Feature modules call `BullModule.registerQueue({ name: QUEUES.X })`
 * and add `@Processor(QUEUES.X)` workers. Repeatable jobs must be registered only when
 * `JOBS_ENABLED` is true (use `upsertJobScheduler` so registration is idempotent).
 */
let QueueModule = class QueueModule {
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            bullmq_1.BullModule.forRootAsync({
                inject: [app_config_service_1.AppConfig],
                useFactory: (config) => ({
                    connection: { ...(0, redis_constants_1.redisOptionsFromUrl)(config.get('REDIS_URL')), maxRetriesPerRequest: null },
                    prefix: `${config.get('REDIS_KEY_PREFIX')}bull`,
                    defaultJobOptions: {
                        attempts: 3,
                        backoff: { type: 'exponential', delay: 5_000 },
                        removeOnComplete: { age: 60 * 60 * 24 * 7, count: 1000 },
                        removeOnFail: { age: 60 * 60 * 24 * 30 },
                    },
                }),
            }),
        ],
        exports: [bullmq_1.BullModule],
    })
], QueueModule);
//# sourceMappingURL=queue.module.js.map