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
exports.AdminTermsController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const permissions_decorator_1 = require("../permissions.decorator");
const admin_terms_service_1 = require("../services/admin-terms.service");
/** 약관 versions: drafts are editable, published versions are immutable. */
let AdminTermsController = class AdminTermsController {
    constructor(terms) {
        this.terms = terms;
    }
    list(q) {
        return this.terms.list(q);
    }
    detail(p) {
        return this.terms.detail(p.id);
    }
    create(dto) {
        return this.terms.create(dto);
    }
    update(p, dto) {
        return this.terms.update(p.id, dto);
    }
    /** Audited inside the publish transaction (records an `urgent` override and its reason). */
    publish(p, dto) {
        return this.terms.publish(p.id, dto);
    }
    remove(p) {
        return this.terms.remove(p.id);
    }
};
exports.AdminTermsController = AdminTermsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.TermsAdminListQueryDto]),
    __metadata("design:returntype", Promise)
], AdminTermsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminTermsController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.Audit)({ action: 'terms.create', resourceType: 'TermsDocument' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.TermsInputDto]),
    __metadata("design:returntype", Promise)
], AdminTermsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, decorators_1.Audit)({ action: 'terms.update', resourceType: 'TermsDocument' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, dto_1.TermsUpdateDto]),
    __metadata("design:returntype", Promise)
], AdminTermsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/publish'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, dto_1.TermsPublishDto]),
    __metadata("design:returntype", Promise)
], AdminTermsController.prototype, "publish", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, decorators_1.Audit)({ action: 'terms.delete', resourceType: 'TermsDocument' }),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminTermsController.prototype, "remove", null);
exports.AdminTermsController = AdminTermsController = __decorate([
    (0, swagger_1.ApiTags)('admin/terms'),
    (0, permissions_decorator_1.RequirePermission)(shared_1.AdminPermission.TERMS_MANAGE),
    (0, common_1.Controller)('admin/terms'),
    __metadata("design:paramtypes", [admin_terms_service_1.AdminTermsService])
], AdminTermsController);
//# sourceMappingURL=admin-terms.controller.js.map