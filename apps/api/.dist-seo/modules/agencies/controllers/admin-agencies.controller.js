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
exports.AdminAgenciesController = void 0;
const node_fs_1 = require("node:fs");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const agency_review_service_1 = require("../services/agency-review.service");
/**
 * Back-office agency review (/api/v1/admin/agencies). The admin module links here from its
 * dashboard; approval logic lives in AgencyReviewService. Decisions are audited in-transaction.
 */
let AdminAgenciesController = class AdminAgenciesController {
    constructor(review) {
        this.review = review;
    }
    list(q) {
        return this.review.list(q);
    }
    /** Full contacts of owner and staff; every view is recorded (`agency.pii-view`). */
    detail(p, q) {
        return this.review.detail(p.id, q);
    }
    /**
     * Soft-deletes a PENDING / REJECTED application (e.g. a fake one), freeing its 등록번호 entry
     * from the queue. Audited in-transaction (`agency.delete`) with the reason.
     */
    remove(p, dto, admin) {
        return this.review.remove(p.id, dto, admin);
    }
    decide(p, dto, admin) {
        return this.review.decide(p.id, dto, admin);
    }
    /** 소재지 변경 (이전신고 확인 후). Owners of approved offices cannot edit these fields. */
    updateLocation(p, dto) {
        return this.review.updateLocation(p.id, dto);
    }
    registryCheck(p, q) {
        return this.review.registryCheck(p.id, q.refresh);
    }
    /** Streams a private document (등록증 등). Never cached; every view is audited. */
    async documentFile(p) {
        const file = await this.review.documentFile(p.id, p.docId);
        return new common_1.StreamableFile((0, node_fs_1.createReadStream)(file.path), {
            type: file.mimeType,
            length: file.sizeBytes,
            disposition: `${file.inline ? 'inline' : 'attachment'}; filename="${file.filename}"`,
        });
    }
};
exports.AdminAgenciesController = AdminAgenciesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AdminAgencyListQueryDto]),
    __metadata("design:returntype", Promise)
], AdminAgenciesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto,
        dto_1.AdminAgencyDetailQueryDto]),
    __metadata("design:returntype", Promise)
], AdminAgenciesController.prototype, "detail", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto,
        dto_1.AgencyAdminDeleteDto, Object]),
    __metadata("design:returntype", Promise)
], AdminAgenciesController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/decision'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto,
        dto_1.AgencyDecisionDto, Object]),
    __metadata("design:returntype", Promise)
], AdminAgenciesController.prototype, "decide", null);
__decorate([
    (0, common_1.Patch)(':id/location'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto,
        dto_1.AgencyLocationUpdateDto]),
    __metadata("design:returntype", Promise)
], AdminAgenciesController.prototype, "updateLocation", null);
__decorate([
    (0, common_1.Get)(':id/registry-check'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto,
        dto_1.AgencyRegistryCheckQueryDto]),
    __metadata("design:returntype", Promise)
], AdminAgenciesController.prototype, "registryCheck", null);
__decorate([
    (0, common_1.Get)(':id/documents/:docId/file'),
    (0, common_1.Header)('Cache-Control', 'private, no-store'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AgencyAdminDocumentParamDto]),
    __metadata("design:returntype", Promise)
], AdminAgenciesController.prototype, "documentFile", null);
exports.AdminAgenciesController = AdminAgenciesController = __decorate([
    (0, swagger_1.ApiTags)('admin/agencies'),
    (0, decorators_1.AdminOnly)(),
    (0, common_1.Controller)('admin/agencies'),
    __metadata("design:paramtypes", [agency_review_service_1.AgencyReviewService])
], AdminAgenciesController);
//# sourceMappingURL=admin-agencies.controller.js.map