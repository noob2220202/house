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
var AdminMaintenanceProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminMaintenanceProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const app_config_service_1 = require("../../../config/app-config.service");
const constants_1 = require("../constants");
const admin_notifications_service_1 = require("../services/admin-notifications.service");
const reports_service_1 = require("../services/reports.service");
/**
 * Admin housekeeping on its own queue: erases reporter contact data past its retention period,
 * derives back-office notifications every 5 minutes and purges expired ones daily.
 * The worker and its schedule only run when JOBS_ENABLED (off in tests; e2e calls the service).
 */
let AdminMaintenanceProcessor = AdminMaintenanceProcessor_1 = class AdminMaintenanceProcessor extends bullmq_1.WorkerHost {
    constructor(reports, notifications, config, queue) {
        super();
        this.reports = reports;
        this.notifications = notifications;
        this.config = config;
        this.queue = queue;
        this.logger = new common_1.Logger(AdminMaintenanceProcessor_1.name);
    }
    async onApplicationBootstrap() {
        if (!this.config.get('JOBS_ENABLED'))
            return;
        await this.queue.upsertJobScheduler(constants_1.ADMIN_JOBS.SCRUB_REPORT_CONTACTS, { pattern: constants_1.SCRUB_REPORT_CONTACTS_PATTERN, tz: 'Asia/Seoul' }, { name: constants_1.ADMIN_JOBS.SCRUB_REPORT_CONTACTS, data: {} });
        await this.queue.upsertJobScheduler(constants_1.ADMIN_JOBS.SYNC_NOTIFICATIONS, { every: constants_1.SYNC_NOTIFICATIONS_EVERY_MS }, { name: constants_1.ADMIN_JOBS.SYNC_NOTIFICATIONS, data: {} });
        await this.queue.upsertJobScheduler(constants_1.ADMIN_JOBS.PURGE_NOTIFICATIONS, { pattern: constants_1.PURGE_NOTIFICATIONS_PATTERN, tz: 'Asia/Seoul' }, { name: constants_1.ADMIN_JOBS.PURGE_NOTIFICATIONS, data: {} });
        this.worker.run().catch((err) => this.logger.error({ err }, 'worker stopped'));
    }
    async process(job) {
        if (job.name === constants_1.ADMIN_JOBS.SYNC_NOTIFICATIONS) {
            return { created: await this.notifications.sync() };
        }
        if (job.name === constants_1.ADMIN_JOBS.PURGE_NOTIFICATIONS) {
            return { purged: await this.notifications.purgeExpired() };
        }
        if (job.name !== constants_1.ADMIN_JOBS.SCRUB_REPORT_CONTACTS) {
            this.logger.warn({ name: job.name }, 'unknown admin job');
            return { scrubbed: 0 };
        }
        const scrubbed = await this.reports.scrubExpiredContacts();
        if (scrubbed > 0)
            this.logger.log({ count: scrubbed }, 'scrubbed expired report contacts');
        return { scrubbed };
    }
};
exports.AdminMaintenanceProcessor = AdminMaintenanceProcessor;
exports.AdminMaintenanceProcessor = AdminMaintenanceProcessor = AdminMaintenanceProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(constants_1.ADMIN_QUEUE, { autorun: false }),
    __param(3, (0, bullmq_1.InjectQueue)(constants_1.ADMIN_QUEUE)),
    __metadata("design:paramtypes", [reports_service_1.ReportsService,
        admin_notifications_service_1.AdminNotificationsService,
        app_config_service_1.AppConfig, Function])
], AdminMaintenanceProcessor);
//# sourceMappingURL=admin-maintenance.processor.js.map