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
var ListingCountersProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingCountersProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const app_config_service_1 = require("../../../config/app-config.service");
const queue_constants_1 = require("../../../queue/queue.constants");
const constants_1 = require("../constants");
const listing_views_service_1 = require("../services/listing-views.service");
/**
 * counters-flush worker for listing view totals (Redis → listings.view_count). The worker and its
 * repeatable schedule only run when JOBS_ENABLED (off in tests; e2e calls the service directly).
 */
let ListingCountersProcessor = ListingCountersProcessor_1 = class ListingCountersProcessor extends bullmq_1.WorkerHost {
    constructor(views, config, queue) {
        super();
        this.views = views;
        this.config = config;
        this.queue = queue;
        this.logger = new common_1.Logger(ListingCountersProcessor_1.name);
    }
    async onApplicationBootstrap() {
        if (!this.config.get('JOBS_ENABLED'))
            return;
        await this.queue.upsertJobScheduler(constants_1.FLUSH_VIEW_COUNTS_JOB, { every: constants_1.FLUSH_VIEW_COUNTS_EVERY_MS }, { name: constants_1.FLUSH_VIEW_COUNTS_JOB });
        this.worker.run().catch((err) => this.logger.error({ err }, 'worker stopped'));
    }
    async process(job) {
        if (job.name !== constants_1.FLUSH_VIEW_COUNTS_JOB) {
            // Another module's job on the shared queue: fail it so BullMQ retries (see openIssues).
            throw new Error(`listings counters worker cannot handle job "${job.name}"`);
        }
        return { flushed: await this.views.flush() };
    }
};
exports.ListingCountersProcessor = ListingCountersProcessor;
exports.ListingCountersProcessor = ListingCountersProcessor = ListingCountersProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(queue_constants_1.QUEUES.COUNTERS_FLUSH, { autorun: false }),
    __param(2, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUES.COUNTERS_FLUSH)),
    __metadata("design:paramtypes", [listing_views_service_1.ListingViewsService,
        app_config_service_1.AppConfig, Function])
], ListingCountersProcessor);
//# sourceMappingURL=listing-counters.processor.js.map