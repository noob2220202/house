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
exports.AdminPopupsController = exports.AdminBannerSlotsController = exports.AdminBannersController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const banner_admin_service_1 = require("../services/banner-admin.service");
const banner_slots_service_1 = require("../services/banner-slots.service");
const banner_stats_service_1 = require("../services/banner-stats.service");
const popup_admin_service_1 = require("../services/popup-admin.service");
let AdminBannersController = class AdminBannersController {
    constructor(banners, stats) {
        this.banners = banners;
        this.stats = stats;
    }
    list(q) {
        return this.banners.list(q);
    }
    // Declared before ':id' routes so "reorder" is never parsed as an id.
    reorder(dto) {
        return this.banners.reorder(dto);
    }
    get(p) {
        return this.banners.get(p.id);
    }
    bannerStats(p, q) {
        return this.stats.forBanner(p.id, q);
    }
    create(dto, admin) {
        return this.banners.create(dto, admin.adminId);
    }
    update(p, dto) {
        return this.banners.update(p.id, dto);
    }
    remove(p) {
        return this.banners.remove(p.id);
    }
};
exports.AdminBannersController = AdminBannersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AdminBannerListQueryDto]),
    __metadata("design:returntype", Promise)
], AdminBannersController.prototype, "list", null);
__decorate([
    (0, common_1.Put)('reorder'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.ReorderBannersDto]),
    __metadata("design:returntype", Promise)
], AdminBannersController.prototype, "reorder", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminBannersController.prototype, "get", null);
__decorate([
    (0, common_1.Get)(':id/stats'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, dto_1.BannerStatsQueryDto]),
    __metadata("design:returntype", Promise)
], AdminBannersController.prototype, "bannerStats", null);
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.Audit)({ action: 'banner.create', resourceType: 'Banner' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateBannerDto, Object]),
    __metadata("design:returntype", Promise)
], AdminBannersController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, decorators_1.Audit)({ action: 'banner.update', resourceType: 'Banner' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, dto_1.UpdateBannerDto]),
    __metadata("design:returntype", Promise)
], AdminBannersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, decorators_1.Audit)({ action: 'banner.delete', resourceType: 'Banner' }),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminBannersController.prototype, "remove", null);
exports.AdminBannersController = AdminBannersController = __decorate([
    (0, swagger_1.ApiTags)('ads'),
    (0, common_1.Controller)('admin/banners'),
    (0, decorators_1.AdminOnly)(shared_1.AdminRole.OPERATOR),
    __metadata("design:paramtypes", [banner_admin_service_1.BannerAdminService,
        banner_stats_service_1.BannerStatsService])
], AdminBannersController);
/** Slot limits: readable by operators (banner forms need them), editable by ADMIN+. */
let AdminBannerSlotsController = class AdminBannerSlotsController {
    constructor(slots) {
        this.slots = slots;
    }
    async list() {
        return { items: await this.slots.list() };
    }
    get(p) {
        return this.slots.get(p.slot);
    }
    update(p, dto) {
        return this.slots.update(p.slot, dto);
    }
};
exports.AdminBannerSlotsController = AdminBannerSlotsController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminBannerSlotsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':slot'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.BannerSlotParamDto]),
    __metadata("design:returntype", Promise)
], AdminBannerSlotsController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)(':slot'),
    (0, decorators_1.AdminOnly)(shared_1.AdminRole.ADMIN),
    (0, decorators_1.Audit)({ action: 'banner-slot.update', resourceType: 'BannerSlotConfig', idParam: 'slot' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.BannerSlotParamDto,
        dto_1.UpdateBannerSlotDto]),
    __metadata("design:returntype", Promise)
], AdminBannerSlotsController.prototype, "update", null);
exports.AdminBannerSlotsController = AdminBannerSlotsController = __decorate([
    (0, swagger_1.ApiTags)('ads'),
    (0, common_1.Controller)('admin/banner-slots'),
    (0, decorators_1.AdminOnly)(shared_1.AdminRole.OPERATOR),
    __metadata("design:paramtypes", [banner_slots_service_1.BannerSlotsService])
], AdminBannerSlotsController);
let AdminPopupsController = class AdminPopupsController {
    constructor(popups) {
        this.popups = popups;
    }
    list(q) {
        return this.popups.list(q);
    }
    reorder(dto) {
        return this.popups.reorder(dto);
    }
    get(p) {
        return this.popups.get(p.id);
    }
    create(dto, admin) {
        return this.popups.create(dto, admin.adminId);
    }
    update(p, dto) {
        return this.popups.update(p.id, dto);
    }
    remove(p) {
        return this.popups.remove(p.id);
    }
};
exports.AdminPopupsController = AdminPopupsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AdminPopupListQueryDto]),
    __metadata("design:returntype", Promise)
], AdminPopupsController.prototype, "list", null);
__decorate([
    (0, common_1.Put)('reorder'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.ReorderPopupsDto]),
    __metadata("design:returntype", Promise)
], AdminPopupsController.prototype, "reorder", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminPopupsController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(),
    (0, decorators_1.Audit)({ action: 'popup.create', resourceType: 'Popup' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, decorators_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreatePopupDto, Object]),
    __metadata("design:returntype", Promise)
], AdminPopupsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, decorators_1.Audit)({ action: 'popup.update', resourceType: 'Popup' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, dto_1.UpdatePopupDto]),
    __metadata("design:returntype", Promise)
], AdminPopupsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, decorators_1.Audit)({ action: 'popup.delete', resourceType: 'Popup' }),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminPopupsController.prototype, "remove", null);
exports.AdminPopupsController = AdminPopupsController = __decorate([
    (0, swagger_1.ApiTags)('ads'),
    (0, common_1.Controller)('admin/popups'),
    (0, decorators_1.AdminOnly)(shared_1.AdminRole.OPERATOR),
    __metadata("design:paramtypes", [popup_admin_service_1.PopupAdminService])
], AdminPopupsController);
//# sourceMappingURL=admin-banners.controller.js.map