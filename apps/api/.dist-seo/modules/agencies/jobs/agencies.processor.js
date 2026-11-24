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
var AgenciesProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgenciesProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const app_config_service_1 = require("../../../config/app-config.service");
const constants_1 = require("../constants");
const agency_dashboard_service_1 = require("../services/agency-dashboard.service");
/** Runs only in the worker process (JOBS_ENABLED); e2e calls AgencyDashboardService directly. */
let AgenciesProcessor = AgenciesProcessor_1 = class AgenciesProcessor extends bullmq_1.WorkerHost {
    constructor(dashboard, config, queue) {
        super();
        this.dashboard = dashboard;
        this.config = config;
        this.queue = queue;
        this.logger = new common_1.Logger(AgenciesProcessor_1.name);
    }
    async onApplicationBootstrap() {
        if (!this.config.get('JOBS_ENABLED'))
            return;
        await this.queue.upsertJobScheduler(constants_1.AGENCY_JOBS.DAILY_STATS, { pattern: constants_1.DAILY_STATS_PATTERN, tz: 'Asia/Seoul' }, { name: constants_1.AGENCY_JOBS.DAILY_STATS, data: {} });
        this.worker.run().catch((err) => this.logger.error({ err }, 'worker stopped'));
    }
    async process(job) {
        switch (job.name) {
            case constants_1.AGENCY_JOBS.DAILY_STATS:
                return { count: await this.dashboard.snapshot() };
            default:
                this.logger.warn({ name: job.name }, 'unknown agencies job');
                return { count: 0 };
        }
    }
    onFailed(job, err) {
        this.logger.warn({ err, name: job?.name, id: job?.id }, 'agencies job failed');
    }
    onError(err) {
        this.logger.error({ err }, 'agencies worker error');
    }
};
exports.AgenciesProcessor = AgenciesProcessor;
__decorate([
    (0, bullmq_1.OnWorkerEvent)('failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Error]),
    __metadata("design:returntype", void 0)
], AgenciesProcessor.prototype, "onFailed", null);
__decorate([
    (0, bullmq_1.OnWorkerEvent)('error'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Error]),
    __metadata("design:returntype", void 0)
], AgenciesProcessor.prototype, "onError", null);
exports.AgenciesProcessor = AgenciesProcessor = AgenciesProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(constants_1.AGENCIES_QUEUE, { autorun: false }),
    __param(2, (0, bullmq_1.InjectQueue)(constants_1.AGENCIES_QUEUE)),
    __metadata("design:paramtypes", [agency_dashboard_service_1.AgencyDashboardService,
        app_config_service_1.AppConfig, Function])
], AgenciesProcessor);
//# sourceMappingURL=agencies.processor.js.map