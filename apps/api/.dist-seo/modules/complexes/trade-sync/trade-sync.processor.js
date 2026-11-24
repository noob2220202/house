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
var TradeSyncProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeSyncProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const app_config_service_1 = require("../../../config/app-config.service");
const queue_constants_1 = require("../../../queue/queue.constants");
const constants_1 = require("../constants");
const complex_popularity_service_1 = require("../services/complex-popularity.service");
const trade_sync_service_1 = require("./trade-sync.service");
/**
 * Worker for the trade-sync queue (owned by complexes): the repeatable 실거래가 sync, admin-started
 * month syncs and rematches, and the complex view-count flush. Runs only when JOBS_ENABLED (e2e
 * processes jobs by calling process()).
 */
let TradeSyncProcessor = TradeSyncProcessor_1 = class TradeSyncProcessor extends bullmq_1.WorkerHost {
    constructor(sync, popularity, config, queue) {
        super();
        this.sync = sync;
        this.popularity = popularity;
        this.config = config;
        this.queue = queue;
        this.logger = new common_1.Logger(TradeSyncProcessor_1.name);
    }
    async onApplicationBootstrap() {
        if (!this.config.get('JOBS_ENABLED'))
            return;
        await this.queue.upsertJobScheduler(constants_1.TRADE_SYNC_JOBS.MONTHLY, { pattern: constants_1.TRADE_SYNC_CRON, tz: constants_1.TRADE_SYNC_TZ }, { name: constants_1.TRADE_SYNC_JOBS.MONTHLY });
        await this.queue.upsertJobScheduler(constants_1.TRADE_SYNC_JOBS.FLUSH_VIEWS, { every: constants_1.FLUSH_VIEWS_EVERY_MS }, { name: constants_1.TRADE_SYNC_JOBS.FLUSH_VIEWS, opts: { attempts: 1 } });
        this.worker.run().catch((err) => this.logger.error({ err }, 'worker stopped'));
    }
    async process(job) {
        switch (job.name) {
            case constants_1.TRADE_SYNC_JOBS.FLUSH_VIEWS:
                return { flushed: await this.popularity.flush() };
            case constants_1.TRADE_SYNC_JOBS.MONTHLY:
                return this.syncRecentMonths(new Date());
            case constants_1.TRADE_SYNC_JOBS.MONTH: {
                const data = parseMonthJob(job.data);
                return this.sync.syncMonth({
                    yearMonth: data.yearMonth,
                    kinds: data.kinds ?? (0, shared_1.enumValues)(shared_1.TradeSyncKind),
                });
            }
            case constants_1.TRADE_SYNC_JOBS.REMATCH:
                return this.sync.rematch(parseRematchJob(job.data).fromYm);
            default:
                throw new Error(`trade-sync worker cannot handle job "${job.name}"`);
        }
    }
    /** Current month (partial) plus the lookback months, oldest first. Failures retry the job. */
    async syncRecentMonths(now) {
        if (!this.sync.configured) {
            this.logger.warn('DATA_GO_KR_SERVICE_KEY not set; skipping 실거래가 sync');
            return { months: [], skipped: 'not configured' };
        }
        const current = (0, shared_1.yearMonthOf)(now);
        const months = (0, shared_1.yearMonthRange)((0, shared_1.addMonths)(current, -constants_1.TRADE_SYNC_LOOKBACK_MONTHS), current);
        for (const yearMonth of months) {
            await this.sync.syncMonth({ yearMonth, kinds: (0, shared_1.enumValues)(shared_1.TradeSyncKind), now });
        }
        return { months };
    }
};
exports.TradeSyncProcessor = TradeSyncProcessor;
exports.TradeSyncProcessor = TradeSyncProcessor = TradeSyncProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(queue_constants_1.QUEUES.TRADE_SYNC, { autorun: false, concurrency: 2 }),
    __param(3, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUES.TRADE_SYNC)),
    __metadata("design:paramtypes", [trade_sync_service_1.TradeSyncService,
        complex_popularity_service_1.ComplexPopularityService,
        app_config_service_1.AppConfig, Function])
], TradeSyncProcessor);
function parseMonthJob(data) {
    const d = (data ?? {});
    if (typeof d.yearMonth !== 'number' || !(0, shared_1.isValidYearMonth)(d.yearMonth)) {
        throw new Error('invalid trade-sync month job payload');
    }
    const kinds = Array.isArray(d.kinds)
        ? d.kinds.filter((k) => (0, shared_1.isEnumValue)(shared_1.TradeSyncKind, k))
        : undefined;
    return { yearMonth: d.yearMonth, kinds: kinds && kinds.length > 0 ? kinds : undefined };
}
function parseRematchJob(data) {
    const d = (data ?? {});
    if (d.fromYm === undefined || d.fromYm === null)
        return {};
    if (typeof d.fromYm !== 'number' || !(0, shared_1.isValidYearMonth)(d.fromYm)) {
        throw new Error('invalid trade-sync rematch job payload');
    }
    return { fromYm: d.fromYm };
}
//# sourceMappingURL=trade-sync.processor.js.map