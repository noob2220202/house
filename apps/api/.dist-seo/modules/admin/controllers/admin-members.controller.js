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
exports.AdminMembersController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const dto_1 = require("../dto");
const permissions_decorator_1 = require("../permissions.decorator");
const members_service_1 = require("../services/members.service");
/**
 * Site members: search/detail for operators, suspension for ADMIN+. GET /:id shows unmasked
 * contacts and is logged as `member.pii-view`; suspension is audited inside its transaction.
 */
let AdminMembersController = class AdminMembersController {
    constructor(members) {
        this.members = members;
    }
    list(q) {
        return this.members.list(q);
    }
    detail(p) {
        return this.members.detail(p.id);
    }
    suspend(p, dto) {
        return this.members.suspend(p.id, dto);
    }
    unsuspend(p) {
        return this.members.unsuspend(p.id);
    }
};
exports.AdminMembersController = AdminMembersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.MemberListQueryDto]),
    __metadata("design:returntype", Promise)
], AdminMembersController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminMembersController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(':id/suspend'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, permissions_decorator_1.RequirePermission)(shared_1.AdminPermission.MEMBERS_SUSPEND),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, dto_1.MemberSuspendDto]),
    __metadata("design:returntype", Promise)
], AdminMembersController.prototype, "suspend", null);
__decorate([
    (0, common_1.Post)(':id/unsuspend'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, permissions_decorator_1.RequirePermission)(shared_1.AdminPermission.MEMBERS_SUSPEND),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminMembersController.prototype, "unsuspend", null);
exports.AdminMembersController = AdminMembersController = __decorate([
    (0, swagger_1.ApiTags)('admin/users'),
    (0, permissions_decorator_1.RequirePermission)(shared_1.AdminPermission.MEMBERS_READ),
    (0, common_1.Controller)('admin/users'),
    __metadata("design:paramtypes", [members_service_1.MembersService])
], AdminMembersController);
//# sourceMappingURL=admin-members.controller.js.map