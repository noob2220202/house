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
var BannerStatsProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BannerStatsProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const app_config_service_1 = require("../../../config/app-config.service");
const queue_constants_1 = require("../../../queue/queue.constants");
const constants_1 = require("../constants");
const ad_tracking_service_1 = require("../services/ad-tracking.service");
/**
 * banner-stats worker: flushes Redis impression/click sets into banner_stat_daily. The worker
 * and its repeatable schedule only run when JOBS_ENABLED (off in tests; e2e calls flush()).
 */
let BannerStatsProcessor = BannerStatsProcessor_1 = class BannerStatsProcessor extends bullmq_1.WorkerHost {
    constructor(tracking, config, queue) {
        super();
        this.tracking = tracking;
        this.config = config;
        this.queue = queue;
        this.logger = new common_1.Logger(BannerStatsProcessor_1.name);
    }
    async onApplicationBootstrap() {
        if (!this.config.get('JOBS_ENABLED'))
            return;
        await this.queue.upsertJobScheduler(constants_1.BANNER_STATS_FLUSH_JOB, { every: constants_1.BANNER_STATS_FLUSH_EVERY_MS }, { name: constants_1.BANNER_STATS_FLUSH_JOB });
        this.worker.run().catch((err) => this.logger.error({ err }, 'worker stopped'));
    }
    async process(job) {
        if (job.name !== constants_1.BANNER_STATS_FLUSH_JOB) {
            throw new Error(`banner-stats worker cannot handle job "${job.name}"`);
        }
        return { written: await this.tracking.flush() };
    }
};
exports.BannerStatsProcessor = BannerStatsProcessor;
exports.BannerStatsProcessor = BannerStatsProcessor = BannerStatsProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(queue_constants_1.QUEUES.BANNER_STATS, { autorun: false }),
    __param(2, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUES.BANNER_STATS)),
    __metadata("design:paramtypes", [ad_tracking_service_1.AdTrackingService,
        app_config_service_1.AppConfig, Function])
], BannerStatsProcessor);
//# sourceMappingURL=banner-stats.processor.js.map