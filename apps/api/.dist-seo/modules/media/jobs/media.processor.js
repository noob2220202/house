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
var MediaProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const app_config_service_1 = require("../../../config/app-config.service");
const queue_constants_1 = require("../../../queue/queue.constants");
const constants_1 = require("../constants");
const media_cleanup_service_1 = require("../media-cleanup.service");
const media_processing_service_1 = require("../media-processing.service");
/**
 * media-processing worker (queue owned by this module): image processing jobs and the hourly
 * orphan cleanup. The worker and the schedule only run when JOBS_ENABLED (off in tests; e2e calls
 * the services directly). Cleanup lives here rather than on the shared `cleanup` queue so no other
 * module's worker can pick up (and fail) media jobs.
 */
let MediaProcessor = MediaProcessor_1 = class MediaProcessor extends bullmq_1.WorkerHost {
    constructor(processing, cleanup, config, queue) {
        super();
        this.processing = processing;
        this.cleanup = cleanup;
        this.config = config;
        this.queue = queue;
        this.logger = new common_1.Logger(MediaProcessor_1.name);
    }
    async onApplicationBootstrap() {
        if (!this.config.get('JOBS_ENABLED'))
            return;
        await this.queue.upsertJobScheduler(constants_1.MEDIA_JOBS.ORPHAN_CLEANUP, { pattern: constants_1.ORPHAN_CLEANUP_CRON, tz: 'Asia/Seoul' }, { name: constants_1.MEDIA_JOBS.ORPHAN_CLEANUP });
        this.worker.run().catch((err) => this.logger.error({ err }, 'worker stopped'));
    }
    async process(job) {
        switch (job.name) {
            case constants_1.MEDIA_JOBS.PROCESS:
                return this.processImage(job);
            case constants_1.MEDIA_JOBS.ORPHAN_CLEANUP:
                return this.cleanup.run();
            default:
                throw new Error(`media worker cannot handle job "${job.name}"`);
        }
    }
    async processImage(job) {
        const { mediaId } = job.data;
        try {
            return await this.processing.processPending(mediaId);
        }
        catch (err) {
            // Transient failure: let BullMQ retry, but leave a FAILED row after the last attempt.
            if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
                await this.processing.markFailed(mediaId);
            }
            throw err;
        }
    }
};
exports.MediaProcessor = MediaProcessor;
exports.MediaProcessor = MediaProcessor = MediaProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(queue_constants_1.QUEUES.MEDIA_PROCESSING, { autorun: false, concurrency: constants_1.MEDIA_WORKER_CONCURRENCY }),
    __param(3, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUES.MEDIA_PROCESSING)),
    __metadata("design:paramtypes", [media_processing_service_1.MediaProcessingService,
        media_cleanup_service_1.MediaCleanupService,
        app_config_service_1.AppConfig, Function])
], MediaProcessor);
//# sourceMappingURL=media.processor.js.map