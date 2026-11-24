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
exports.AdminAccountsController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const permissions_decorator_1 = require("../permissions.decorator");
const admin_accounts_service_1 = require("../services/admin-accounts.service");
/**
 * Back-office accounts (SUPER_ADMIN only). DELETE is a soft delete (the row stays DISABLED with a
 * released e-mail so audit history keeps its actor).
 */
let AdminAccountsController = class AdminAccountsController {
    constructor(accounts) {
        this.accounts = accounts;
    }
    list(q) {
        return this.accounts.list(q);
    }
    detail(p) {
        return this.accounts.detail(p.id);
    }
    create(dto) {
        return this.accounts.create(dto);
    }
    update(p, dto, actor) {
        return this.accounts.update(actor, p.id, dto);
    }
    resetPassword(p, dto, actor) {
        return this.accounts.resetPassword(actor, p.id, dto);
    }
    resetTotp(p, actor) {
        return this.accounts.resetTotp(actor, p.id);
    }
    remove(p, actor) {
        return this.accounts.remove(actor, p.id);
    }
    unlock(p) {
        return this.accounts.unlock(p.id);
    }
};
exports.AdminAccountsController = AdminAccountsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AdminAccountListQueryDto]),
    __metadata("design:returntype", Promise)
], AdminAccountsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminAccountsController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.Audit)({ action: 'admin-account.create', resourceType: 'AdminUser' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AdminAccountCreateDto]),
    __metadata("design:returntype", Promise)
], AdminAccountsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, decorators_1.Audit)({ action: 'admin-account.update', resourceType: 'AdminUser' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto,
        dto_1.AdminAccountUpdateDto, Object]),
    __metadata("design:returntype", Promise)
], AdminAccountsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/reset-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, decorators_1.Audit)({ action: 'admin-account.reset-password', resourceType: 'AdminUser' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto,
        dto_1.AdminPasswordResetDto, Object]),
    __metadata("design:returntype", Promise)
], AdminAccountsController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Post)(':id/reset-totp'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, decorators_1.Audit)({ action: 'admin-account.reset-totp', resourceType: 'AdminUser' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, decorators_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, Object]),
    __metadata("design:returntype", Promise)
], AdminAccountsController.prototype, "resetTotp", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, decorators_1.Audit)({ action: 'admin-account.delete', resourceType: 'AdminUser' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, decorators_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, Object]),
    __metadata("design:returntype", Promise)
], AdminAccountsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/unlock'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, decorators_1.Audit)({ action: 'admin-account.unlock', resourceType: 'AdminUser' }),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminAccountsController.prototype, "unlock", null);
exports.AdminAccountsController = AdminAccountsController = __decorate([
    (0, swagger_1.ApiTags)('admin/admins'),
    (0, permissions_decorator_1.RequirePermission)(shared_1.AdminPermission.ADMINS_MANAGE),
    (0, common_1.Controller)('admin/admins'),
    __metadata("design:paramtypes", [admin_accounts_service_1.AdminAccountsService])
], AdminAccountsController);
//# sourceMappingURL=admin-accounts.controller.js.map