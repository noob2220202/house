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
exports.AdminReportsController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const permissions_decorator_1 = require("../permissions.decorator");
const reports_service_1 = require("../services/reports.service");
/** 허위매물 신고 queue. Resolution is audited inside its transaction (ReportsService.resolve). */
let AdminReportsController = class AdminReportsController {
    constructor(reports) {
        this.reports = reports;
    }
    list(q) {
        return this.reports.list(q);
    }
    detail(p) {
        return this.reports.detail(p.id);
    }
    review(p, dto, admin) {
        return this.reports.review(p.id, dto, admin);
    }
    resolve(p, dto, admin) {
        return this.reports.resolve(p.id, dto, admin);
    }
};
exports.AdminReportsController = AdminReportsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.ReportListQueryDto]),
    __metadata("design:returntype", Promise)
], AdminReportsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminReportsController.prototype, "detail", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, decorators_1.Audit)({ action: 'report.review', resourceType: 'Report' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto,
        dto_1.ReportReviewDto, Object]),
    __metadata("design:returntype", Promise)
], AdminReportsController.prototype, "review", null);
__decorate([
    (0, common_1.Post)(':id/resolve'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto,
        dto_1.ReportResolveDto, Object]),
    __metadata("design:returntype", Promise)
], AdminReportsController.prototype, "resolve", null);
exports.AdminReportsController = AdminReportsController = __decorate([
    (0, swagger_1.ApiTags)('admin/reports'),
    (0, permissions_decorator_1.RequirePermission)(shared_1.AdminPermission.REPORTS_MANAGE),
    (0, common_1.Controller)('admin/reports'),
    __metadata("design:paramtypes", [reports_service_1.ReportsService])
], AdminReportsController);
//# sourceMappingURL=admin-reports.controller.js.map