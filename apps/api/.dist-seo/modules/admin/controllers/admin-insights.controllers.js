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
exports.AdminSocialLoginController = exports.AdminStatsController = exports.AdminNotificationsController = exports.AdminSearchController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const permissions_decorator_1 = require("../permissions.decorator");
const admin_notifications_service_1 = require("../services/admin-notifications.service");
const admin_search_service_1 = require("../services/admin-search.service");
const admin_stats_service_1 = require("../services/admin-stats.service");
const social_login_status_service_1 = require("../services/social-login-status.service");
/** Topbar search across listings, agencies and members (members masked). Every admin role. */
let AdminSearchController = class AdminSearchController {
    constructor(search) {
        this.search = search;
    }
    get(q) {
        return this.search.search(q);
    }
};
exports.AdminSearchController = AdminSearchController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Header)('Cache-Control', 'private, no-store'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AdminSearchQueryDto]),
    __metadata("design:returntype", Promise)
], AdminSearchController.prototype, "get", null);
exports.AdminSearchController = AdminSearchController = __decorate([
    (0, swagger_1.ApiTags)('admin'),
    (0, permissions_decorator_1.RequirePermission)(shared_1.AdminPermission.DASHBOARD_READ),
    (0, common_1.Controller)('admin/search'),
    __metadata("design:paramtypes", [admin_search_service_1.AdminSearchService])
], AdminSearchController);
/** The console bell: shared notifications, read state per admin. Every admin role. */
let AdminNotificationsController = class AdminNotificationsController {
    constructor(notifications) {
        this.notifications = notifications;
    }
    list(q, admin) {
        return this.notifications.list(admin.adminId, q);
    }
    /** Declared before `:id/read` so "read-all" is never parsed as an id. */
    readAll(admin) {
        return this.notifications.markAllRead(admin.adminId);
    }
    read(p, admin) {
        return this.notifications.markRead(admin.adminId, p.id);
    }
};
exports.AdminNotificationsController = AdminNotificationsController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Header)('Cache-Control', 'private, no-store'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, decorators_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AdminNotificationListQueryDto, Object]),
    __metadata("design:returntype", Promise)
], AdminNotificationsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('read-all'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, decorators_1.Audit)({ action: 'admin-notification.read-all', resourceType: 'AdminNotification' }),
    __param(0, (0, decorators_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminNotificationsController.prototype, "readAll", null);
__decorate([
    (0, common_1.Post)(':id/read'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, decorators_1.Audit)({ action: 'admin-notification.read', resourceType: 'AdminNotification' }),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, decorators_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto, Object]),
    __metadata("design:returntype", Promise)
], AdminNotificationsController.prototype, "read", null);
exports.AdminNotificationsController = AdminNotificationsController = __decorate([
    (0, swagger_1.ApiTags)('admin'),
    (0, permissions_decorator_1.RequirePermission)(shared_1.AdminPermission.DASHBOARD_READ),
    (0, common_1.Controller)('admin/notifications'),
    __metadata("design:paramtypes", [admin_notifications_service_1.AdminNotificationsService])
], AdminNotificationsController);
/** 통계: traffic · listings · deal-requests · ads, `?days=7|30|90`. Every admin role. */
let AdminStatsController = class AdminStatsController {
    constructor(stats) {
        this.stats = stats;
    }
    get(p, q) {
        return this.stats.get(p.section, q.days);
    }
};
exports.AdminStatsController = AdminStatsController;
__decorate([
    (0, common_1.Get)(':section'),
    (0, common_1.Header)('Cache-Control', 'private, no-store'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.StatsSectionParamDto, dto_1.StatsQueryDto]),
    __metadata("design:returntype", Promise)
], AdminStatsController.prototype, "get", null);
exports.AdminStatsController = AdminStatsController = __decorate([
    (0, swagger_1.ApiTags)('admin'),
    (0, permissions_decorator_1.RequirePermission)(shared_1.AdminPermission.DASHBOARD_READ),
    (0, common_1.Controller)('admin/stats'),
    __metadata("design:paramtypes", [admin_stats_service_1.AdminStatsService])
], AdminStatsController);
/** Read-only OAuth provider status (카카오 · 네이버 · Google); secrets are never returned. ADMIN+. */
let AdminSocialLoginController = class AdminSocialLoginController {
    constructor(status) {
        this.status = status;
    }
    get() {
        return this.status.status();
    }
};
exports.AdminSocialLoginController = AdminSocialLoginController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Header)('Cache-Control', 'private, no-store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminSocialLoginController.prototype, "get", null);
exports.AdminSocialLoginController = AdminSocialLoginController = __decorate([
    (0, swagger_1.ApiTags)('admin'),
    (0, permissions_decorator_1.RequirePermission)(shared_1.AdminPermission.SETTINGS_MANAGE),
    (0, common_1.Controller)('admin/social-login'),
    __metadata("design:paramtypes", [social_login_status_service_1.SocialLoginStatusService])
], AdminSocialLoginController);
//# sourceMappingURL=admin-insights.controllers.js.map