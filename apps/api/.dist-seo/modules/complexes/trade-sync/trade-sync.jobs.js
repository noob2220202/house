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
var TradeSyncJobs_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeSyncJobs = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const app_config_service_1 = require("../../../config/app-config.service");
const queue_constants_1 = require("../../../queue/queue.constants");
const constants_1 = require("../constants");
const KIND_BY_NAME = {
    [constants_1.TRADE_SYNC_JOBS.MONTH]: 'MONTH',
    [constants_1.TRADE_SYNC_JOBS.REMATCH]: 'REMATCH',
};
function toState(raw) {
    switch (raw) {
        case 'active':
        case 'delayed':
        case 'completed':
        case 'failed':
            return raw;
        default:
            return 'waiting';
    }
}
/**
 * Enqueues admin-started trade-sync work on the trade-sync queue and reports its progress. Job ids
 * are derived from the parameters, so repeating a request while the job is waiting/running returns
 * the same job instead of starting a second run; a finished job is replaced by a fresh one.
 */
let TradeSyncJobs = TradeSyncJobs_1 = class TradeSyncJobs {
    constructor(queue, config) {
        this.queue = queue;
        this.config = config;
        this.logger = new common_1.Logger(TradeSyncJobs_1.name);
    }
    enqueueMonth(yearMonth, kinds) {
        // Canonical (enum) order: it is also the order the kinds are synced in.
        const order = (0, shared_1.enumValues)(shared_1.TradeSyncKind);
        const sorted = [...new Set(kinds)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
        const sgg = this.config.get('REGION_SGG_CODE');
        return this.enqueue(constants_1.TRADE_SYNC_JOBS.MONTH, `month.${sgg}.${yearMonth}.${sorted.join('+')}`, {
            yearMonth,
            kinds: sorted,
        });
    }
    enqueueRematch(fromYm) {
        const sgg = this.config.get('REGION_SGG_CODE');
        return this.enqueue(constants_1.TRADE_SYNC_JOBS.REMATCH, `rematch.${sgg}.${fromYm ?? 'all'}`, {
            ...(fromYm ? { fromYm } : {}),
        });
    }
    /** Best effort (logged): used after 단지 edits, where the edit itself must not fail. */
    async requestRematch() {
        try {
            await this.enqueueRematch();
        }
        catch (err) {
            this.logger.warn({ err }, 'could not enqueue trade rematch');
        }
    }
    async get(jobId) {
        const job = await this.queue.getJob(jobId);
        const kind = job ? KIND_BY_NAME[job.name] : undefined;
        if (!job || !kind)
            return null;
        const state = toState(await job.getState());
        return {
            jobId,
            kind,
            state,
            params: (job.data ?? {}),
            attemptsMade: job.attemptsMade,
            result: state === 'completed'
                ? (job.returnvalue ?? null)
                : null,
            failedReason: job.failedReason ? job.failedReason.slice(0, 500) : null,
            createdAt: new Date(job.timestamp).toISOString(),
            finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        };
    }
    async enqueue(name, jobId, data) {
        const kind = KIND_BY_NAME[name];
        const existing = await this.queue.getJob(jobId);
        if (existing) {
            const state = await existing.getState();
            if (state !== 'completed' && state !== 'failed') {
                return { jobId, kind, state: toState(state) };
            }
            // Finished: replace it (removal of a job that just got picked up fails; add() then dedupes).
            await existing.remove().catch(() => undefined);
        }
        const job = await this.queue.add(name, data, { jobId });
        return { jobId: job.id ?? jobId, kind, state: toState(await job.getState()) };
    }
};
exports.TradeSyncJobs = TradeSyncJobs;
exports.TradeSyncJobs = TradeSyncJobs = TradeSyncJobs_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUES.TRADE_SYNC)),
    __metadata("design:paramtypes", [Function, app_config_service_1.AppConfig])
], TradeSyncJobs);
//# sourceMappingURL=trade-sync.jobs.js.map