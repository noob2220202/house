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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminTradeSyncController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const audit_service_1 = require("../../../common/audit/audit.service");
const decorators_1 = require("../../../common/decorators");
const app_exception_1 = require("../../../common/errors/app.exception");
const dto_1 = require("../dto");
const trade_sync_jobs_1 = require("../trade-sync/trade-sync.jobs");
const trade_sync_service_1 = require("../trade-sync/trade-sync.service");
/**
 * Manual 실거래가 sync / rematch. Both run as jobs on the trade-sync queue (a sync can take far
 * longer than the proxy timeout): the POST answers 202 with the job id, the admin polls
 * GET jobs/:jobId (result) or GET runs (per-kind run records).
 */
let AdminTradeSyncController = class AdminTradeSyncController {
    constructor(sync, jobs, audit) {
        this.sync = sync;
        this.jobs = jobs;
        this.audit = audit;
    }
    async run(dto) {
        this.sync.assertSyncable(dto.yearMonth);
        const accepted = await this.jobs.enqueueMonth(dto.yearMonth, dto.kinds);
        await this.audit.record({
            action: 'trade-sync.run',
            resourceType: 'TradeSyncRun',
            after: { yearMonth: dto.yearMonth, kinds: dto.kinds, jobId: accepted.jobId },
        });
        return accepted;
    }
    runs(q) {
        return this.sync.listRuns(q);
    }
    async job(p) {
        const view = await this.jobs.get(p.jobId);
        if (!view)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.TRADE_SYNC_JOB_NOT_FOUND);
        return view;
    }
    async rematch(dto) {
        const accepted = await this.jobs.enqueueRematch(dto.fromYm);
        await this.audit.record({
            action: 'trade-sync.rematch',
            resourceType: 'TradeRecord',
            after: { fromYm: dto.fromYm ?? null, jobId: accepted.jobId },
        });
        return accepted;
    }
};
exports.AdminTradeSyncController = AdminTradeSyncController;
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.AdminOnly)(shared_1.AdminRole.ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.TradeSyncRequestDto]),
    __metadata("design:returntype", Promise)
], AdminTradeSyncController.prototype, "run", null);
__decorate([
    (0, common_1.Get)('runs'),
    (0, decorators_1.AdminOnly)(shared_1.AdminRole.OPERATOR),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.TradeSyncRunsQueryDto]),
    __metadata("design:returntype", Promise)
], AdminTradeSyncController.prototype, "runs", null);
__decorate([
    (0, common_1.Get)('jobs/:jobId'),
    (0, decorators_1.AdminOnly)(shared_1.AdminRole.OPERATOR),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.TradeSyncJobParamDto]),
    __metadata("design:returntype", Promise)
], AdminTradeSyncController.prototype, "job", null);
__decorate([
    (0, common_1.Post)('rematch'),
    (0, decorators_1.AdminOnly)(shared_1.AdminRole.ADMIN),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.TradeRematchRequestDto]),
    __metadata("design:returntype", Promise)
], AdminTradeSyncController.prototype, "rematch", null);
exports.AdminTradeSyncController = AdminTradeSyncController = __decorate([
    (0, swagger_1.ApiTags)('complexes'),
    (0, common_1.Controller)('admin/complexes/trade-sync'),
    __metadata("design:paramtypes", [trade_sync_service_1.TradeSyncService,
        trade_sync_jobs_1.TradeSyncJobs,
        audit_service_1.AuditService])
], AdminTradeSyncController);
//# sourceMappingURL=admin-trade-sync.controller.js.map