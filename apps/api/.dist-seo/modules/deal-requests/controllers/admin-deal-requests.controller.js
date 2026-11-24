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
exports.AdminDealRequestsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const admin_deal_requests_service_1 = require("../services/admin-deal-requests.service");
/** Back-office moderation of 내놓기/구하기 (/api/v1/admin/deal-requests). */
let AdminDealRequestsController = class AdminDealRequestsController {
    constructor(admin) {
        this.admin = admin;
    }
    list(q) {
        return this.admin.list(q);
    }
    get(p) {
        return this.admin.get(p.id);
    }
    close(p, dto) {
        return this.admin.close(p.id, dto);
    }
    /**
     * Spam flag `{ flagged, reason? }` (reason ≥ 5 chars when flagging). A flagged request is hidden
     * from every agency until the flag is cleared.
     */
    spamFlag(p, dto, admin) {
        return this.admin.setSpamFlag(p.id, dto, admin.adminId);
    }
};
exports.AdminDealRequestsController = AdminDealRequestsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AdminDealRequestListQueryDto]),
    __metadata("design:returntype", Promise)
], AdminDealRequestsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminDealRequestsController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(':id/close'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, decorators_1.Audit)({ action: 'dealRequest.close', resourceType: 'DealRequest' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto,
        dto_1.AdminDealRequestCloseDto]),
    __metadata("design:returntype", Promise)
], AdminDealRequestsController.prototype, "close", null);
__decorate([
    (0, common_1.Post)(':id/spam-flag'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, decorators_1.Audit)({ action: 'dealRequest.spamFlag', resourceType: 'DealRequest' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto,
        dto_1.AdminDealRequestSpamFlagDto, Object]),
    __metadata("design:returntype", Promise)
], AdminDealRequestsController.prototype, "spamFlag", null);
exports.AdminDealRequestsController = AdminDealRequestsController = __decorate([
    (0, swagger_1.ApiTags)('admin/deal-requests'),
    (0, decorators_1.AdminOnly)(),
    (0, common_1.Controller)('admin/deal-requests'),
    __metadata("design:paramtypes", [admin_deal_requests_service_1.AdminDealRequestsService])
], AdminDealRequestsController);
//# sourceMappingURL=admin-deal-requests.controller.js.map