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
exports.AdminSiteSettingsController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const permissions_decorator_1 = require("../permissions.decorator");
const site_settings_service_1 = require("../services/site-settings.service");
/** Site settings (ADMIN+). PUT body is the setting value itself, validated per key. */
let AdminSiteSettingsController = class AdminSiteSettingsController {
    constructor(settings) {
        this.settings = settings;
    }
    list() {
        return this.settings.list();
    }
    get(p) {
        return this.settings.get(p.key);
    }
    put(p, value, admin) {
        return this.settings.put(p.key, value, admin);
    }
};
exports.AdminSiteSettingsController = AdminSiteSettingsController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminSiteSettingsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':key'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.SiteSettingKeyParamDto]),
    __metadata("design:returntype", Promise)
], AdminSiteSettingsController.prototype, "get", null);
__decorate([
    (0, common_1.Put)(':key'),
    (0, decorators_1.Audit)({ action: 'site-setting.update', resourceType: 'SiteSetting', idParam: 'key' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, decorators_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.SiteSettingKeyParamDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminSiteSettingsController.prototype, "put", null);
exports.AdminSiteSettingsController = AdminSiteSettingsController = __decorate([
    (0, swagger_1.ApiTags)('admin/site-settings'),
    (0, permissions_decorator_1.RequirePermission)(shared_1.AdminPermission.SETTINGS_MANAGE),
    (0, common_1.Controller)('admin/site-settings'),
    __metadata("design:paramtypes", [site_settings_service_1.SiteSettingsService])
], AdminSiteSettingsController);
//# sourceMappingURL=admin-site-settings.controller.js.map