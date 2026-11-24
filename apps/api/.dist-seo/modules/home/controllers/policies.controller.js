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
exports.AdminPoliciesController = exports.PoliciesController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const policies_service_1 = require("../services/policies.service");
let PoliciesController = class PoliciesController {
    constructor(policies) {
        this.policies = policies;
    }
    /** The version in force of an operating policy page; 404 until one is published. */
    get(p) {
        return this.policies.current(p.slug);
    }
};
exports.PoliciesController = PoliciesController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Get)(':slug'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.PolicySlugParamDto]),
    __metadata("design:returntype", Promise)
], PoliciesController.prototype, "get", null);
exports.PoliciesController = PoliciesController = __decorate([
    (0, swagger_1.ApiTags)('home'),
    (0, common_1.Controller)('policies'),
    __metadata("design:paramtypes", [policies_service_1.PoliciesService])
], PoliciesController);
/** 운영 정책 문서 versions (same permission as 약관): drafts editable, published immutable. */
let AdminPoliciesController = class AdminPoliciesController {
    constructor(policies) {
        this.policies = policies;
    }
    list(q) {
        return this.policies.list(q);
    }
    detail(p) {
        return this.policies.detail(p.id);
    }
    create(dto) {
        return this.policies.create(dto);
    }
    update(p, dto) {
        return this.policies.update(p.id, dto);
    }
    publish(p) {
        return this.policies.publish(p.id);
    }
    remove(p) {
        return this.policies.remove(p.id);
    }
};
exports.AdminPoliciesController = AdminPoliciesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.PolicyAdminListQueryDto]),
    __metadata("design:returntype", Promise)
], AdminPoliciesController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminPoliciesController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.Audit)({ action: 'policy.create', resourceType: 'PolicyDocument' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.PolicyCreateDto]),
    __metadata("design:returntype", Promise)
], AdminPoliciesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, decorators_1.Audit)({ action: 'policy.update', resourceType: 'PolicyDocument' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, dto_1.PolicyUpdateDto]),
    __metadata("design:returntype", Promise)
], AdminPoliciesController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/publish'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, decorators_1.Audit)({ action: 'policy.publish', resourceType: 'PolicyDocument' }),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminPoliciesController.prototype, "publish", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, decorators_1.Audit)({ action: 'policy.delete', resourceType: 'PolicyDocument' }),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminPoliciesController.prototype, "remove", null);
exports.AdminPoliciesController = AdminPoliciesController = __decorate([
    (0, swagger_1.ApiTags)('admin/policies'),
    (0, decorators_1.Roles)(...(0, shared_1.adminRolesWith)(shared_1.AdminPermission.TERMS_MANAGE)),
    (0, common_1.Controller)('admin/policies'),
    __metadata("design:paramtypes", [policies_service_1.PoliciesService])
], AdminPoliciesController);
//# sourceMappingURL=policies.controller.js.map