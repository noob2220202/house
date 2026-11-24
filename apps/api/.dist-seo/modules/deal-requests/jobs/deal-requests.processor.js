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
var DealRequestsProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealRequestsProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const app_config_service_1 = require("../../../config/app-config.service");
const constants_1 = require("../constants");
const deal_request_maintenance_service_1 = require("../services/deal-request-maintenance.service");
/** Runs only in the worker process (JOBS_ENABLED); e2e calls the maintenance service directly. */
let DealRequestsProcessor = DealRequestsProcessor_1 = class DealRequestsProcessor extends bullmq_1.WorkerHost {
    constructor(maintenance, config, queue) {
        super();
        this.maintenance = maintenance;
        this.config = config;
        this.queue = queue;
        this.logger = new common_1.Logger(DealRequestsProcessor_1.name);
    }
    async onApplicationBootstrap() {
        if (!this.config.get('JOBS_ENABLED'))
            return;
        await this.queue.upsertJobScheduler(constants_1.DEAL_REQUEST_JOBS.EXPIRE, { pattern: constants_1.EXPIRE_PATTERN, tz: 'Asia/Seoul' }, { name: constants_1.DEAL_REQUEST_JOBS.EXPIRE, data: {} });
        await this.queue.upsertJobScheduler(constants_1.DEAL_REQUEST_JOBS.SCRUB, { pattern: constants_1.SCRUB_PATTERN, tz: 'Asia/Seoul' }, { name: constants_1.DEAL_REQUEST_JOBS.SCRUB, data: {} });
        this.worker.run().catch((err) => this.logger.error({ err }, 'worker stopped'));
    }
    async process(job) {
        switch (job.name) {
            case constants_1.DEAL_REQUEST_JOBS.FANOUT: {
                const id = job.data.dealRequestId;
                if (typeof id !== 'string')
                    return { count: 0 };
                return { count: await this.maintenance.fanout(id) };
            }
            case constants_1.DEAL_REQUEST_JOBS.EXPIRE:
                return { count: await this.maintenance.expireDue() };
            case constants_1.DEAL_REQUEST_JOBS.SCRUB:
                return { count: await this.maintenance.scrubDue() };
            default:
                this.logger.warn({ name: job.name }, 'unknown deal-requests job');
                return { count: 0 };
        }
    }
    onFailed(job, err) {
        this.logger.warn({ err, name: job?.name, id: job?.id }, 'deal-requests job failed');
    }
    /** Without a listener, worker errors (e.g. Redis hiccups) surface as unhandled 'error' events. */
    onError(err) {
        this.logger.error({ err }, 'deal-requests worker error');
    }
};
exports.DealRequestsProcessor = DealRequestsProcessor;
__decorate([
    (0, bullmq_1.OnWorkerEvent)('failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Error]),
    __metadata("design:returntype", void 0)
], DealRequestsProcessor.prototype, "onFailed", null);
__decorate([
    (0, bullmq_1.OnWorkerEvent)('error'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Error]),
    __metadata("design:returntype", void 0)
], DealRequestsProcessor.prototype, "onError", null);
exports.DealRequestsProcessor = DealRequestsProcessor = DealRequestsProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(constants_1.DEAL_REQUESTS_QUEUE, { autorun: false }),
    __param(2, (0, bullmq_1.InjectQueue)(constants_1.DEAL_REQUESTS_QUEUE)),
    __metadata("design:paramtypes", [deal_request_maintenance_service_1.DealRequestMaintenanceService,
        app_config_service_1.AppConfig, Function])
], DealRequestsProcessor);
//# sourceMappingURL=deal-requests.processor.js.map