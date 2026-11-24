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
var AuthMaintenanceProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthMaintenanceProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const app_config_service_1 = require("../../../config/app-config.service");
const auth_constants_1 = require("../auth.constants");
const pii_scrub_service_1 = require("./pii-scrub.service");
/** Daily at 04:17 KST (off-peak, off the hour). */
const PII_SCRUB_PATTERN = '17 4 * * *';
/** Runs only in the worker process (JOBS_ENABLED); e2e calls PiiScrubService directly. */
let AuthMaintenanceProcessor = AuthMaintenanceProcessor_1 = class AuthMaintenanceProcessor extends bullmq_1.WorkerHost {
    constructor(scrubber, config, queue) {
        super();
        this.scrubber = scrubber;
        this.config = config;
        this.queue = queue;
        this.logger = new common_1.Logger(AuthMaintenanceProcessor_1.name);
    }
    async onApplicationBootstrap() {
        if (!this.config.get('JOBS_ENABLED'))
            return;
        await this.queue.upsertJobScheduler(auth_constants_1.AUTH_JOBS.PII_SCRUB, { pattern: PII_SCRUB_PATTERN, tz: 'Asia/Seoul' }, { name: auth_constants_1.AUTH_JOBS.PII_SCRUB, data: {} });
        this.worker.run().catch((err) => this.logger.error({ err }, 'worker stopped'));
    }
    async process(job) {
        if (job.name !== auth_constants_1.AUTH_JOBS.PII_SCRUB) {
            this.logger.warn({ name: job.name }, 'unknown auth job');
            return { scrubbed: 0 };
        }
        return { scrubbed: await this.scrubber.scrubDue() };
    }
};
exports.AuthMaintenanceProcessor = AuthMaintenanceProcessor;
exports.AuthMaintenanceProcessor = AuthMaintenanceProcessor = AuthMaintenanceProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(auth_constants_1.AUTH_QUEUE, { autorun: false }),
    __param(2, (0, bullmq_1.InjectQueue)(auth_constants_1.AUTH_QUEUE)),
    __metadata("design:paramtypes", [pii_scrub_service_1.PiiScrubService,
        app_config_service_1.AppConfig, Function])
], AuthMaintenanceProcessor);
//# sourceMappingURL=auth-maintenance.processor.js.map