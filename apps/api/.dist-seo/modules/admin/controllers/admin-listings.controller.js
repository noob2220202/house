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
exports.AdminListingsController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const permissions_decorator_1 = require("../permissions.decorator");
const admin_listings_service_1 = require("../services/admin-listings.service");
/** Listing moderation across all agencies: hide / unhide / force close. */
let AdminListingsController = class AdminListingsController {
    constructor(listings) {
        this.listings = listings;
    }
    list(q) {
        return this.listings.list(q);
    }
    detail(p) {
        return this.listings.detail(p.id);
    }
    hide(p, dto) {
        return this.listings.hide(p.id, dto);
    }
    unhide(p) {
        return this.listings.unhide(p.id);
    }
    close(p, dto) {
        return this.listings.forceClose(p.id, dto);
    }
};
exports.AdminListingsController = AdminListingsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AdminListingListQueryDto]),
    __metadata("design:returntype", Promise)
], AdminListingsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminListingsController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(':id/hide'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, decorators_1.Audit)({ action: 'listing.hide', resourceType: 'Listing' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto,
        dto_1.AdminListingModerationDto]),
    __metadata("design:returntype", Promise)
], AdminListingsController.prototype, "hide", null);
__decorate([
    (0, common_1.Post)(':id/unhide'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, decorators_1.Audit)({ action: 'listing.unhide', resourceType: 'Listing' }),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminListingsController.prototype, "unhide", null);
__decorate([
    (0, common_1.Post)(':id/close'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, decorators_1.Audit)({ action: 'listing.force-close', resourceType: 'Listing' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto,
        dto_1.AdminListingModerationDto]),
    __metadata("design:returntype", Promise)
], AdminListingsController.prototype, "close", null);
exports.AdminListingsController = AdminListingsController = __decorate([
    (0, swagger_1.ApiTags)('admin/listings'),
    (0, permissions_decorator_1.RequirePermission)(shared_1.AdminPermission.LISTINGS_MODERATE),
    (0, common_1.Controller)('admin/listings'),
    __metadata("design:paramtypes", [admin_listings_service_1.AdminListingsService])
], AdminListingsController);
//# sourceMappingURL=admin-listings.controller.js.map