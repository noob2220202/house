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
exports.AdminAuditLogsController = exports.AdminDashboardController = exports.AdminPermissionsController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../../../common/decorators");
const dto_1 = require("../dto");
const permissions_decorator_1 = require("../permissions.decorator");
const audit_logs_service_1 = require("../services/audit-logs.service");
const admin_notifications_service_1 = require("../services/admin-notifications.service");
const dashboard_queues_service_1 = require("../services/dashboard-queues.service");
const dashboard_service_1 = require("../services/dashboard.service");
/** What the signed-in admin may do (drives the back-office menu). */
let AdminPermissionsController = class AdminPermissionsController {
    get(admin) {
        return {
            adminId: admin.adminId,
            role: admin.role,
            permissions: [...shared_1.ADMIN_ROLE_PERMISSIONS[admin.role]],
        };
    }
};
exports.AdminPermissionsController = AdminPermissionsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, decorators_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], AdminPermissionsController.prototype, "get", null);
exports.AdminPermissionsController = AdminPermissionsController = __decorate([
    (0, swagger_1.ApiTags)('admin'),
    (0, decorators_1.AdminOnly)(),
    (0, common_1.Controller)('admin/permissions')
], AdminPermissionsController);
let AdminDashboardController = class AdminDashboardController {
    constructor(dashboard, queues, notifications) {
        this.dashboard = dashboard;
        this.queues = queues;
        this.notifications = notifications;
    }
    /** Counters (cached, shared) plus this admin's unread bell count (`notificationsUnread`). */
    async get(admin) {
        await this.notifications.syncThrottled();
        const [summary, notificationsUnread] = await Promise.all([
            this.dashboard.get(),
            this.notifications.unreadCount(admin.adminId),
        ]);
        return { ...summary, notificationsUnread };
    }
    /** Work queues previewed on the dashboard (pending agencies, deal requests, reports, ads). */
    getQueues() {
        return this.queues.get();
    }
};
exports.AdminDashboardController = AdminDashboardController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.Header)('Cache-Control', 'private, no-store'),
    __param(0, (0, decorators_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminDashboardController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('queues'),
    (0, common_1.Header)('Cache-Control', 'private, no-store'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminDashboardController.prototype, "getQueues", null);
exports.AdminDashboardController = AdminDashboardController = __decorate([
    (0, swagger_1.ApiTags)('admin'),
    (0, permissions_decorator_1.RequirePermission)(shared_1.AdminPermission.DASHBOARD_READ),
    (0, common_1.Controller)('admin/dashboard'),
    __metadata("design:paramtypes", [dashboard_service_1.DashboardService,
        dashboard_queues_service_1.DashboardQueuesService,
        admin_notifications_service_1.AdminNotificationsService])
], AdminDashboardController);
let AdminAuditLogsController = class AdminAuditLogsController {
    constructor(logs) {
        this.logs = logs;
    }
    list(q) {
        return this.logs.list(q);
    }
    detail(p) {
        return this.logs.detail(p.id);
    }
};
exports.AdminAuditLogsController = AdminAuditLogsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AuditLogQueryDto]),
    __metadata("design:returntype", Promise)
], AdminAuditLogsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AdminAuditLogsController.prototype, "detail", null);
exports.AdminAuditLogsController = AdminAuditLogsController = __decorate([
    (0, swagger_1.ApiTags)('admin/audit-logs'),
    (0, permissions_decorator_1.RequirePermission)(shared_1.AdminPermission.AUDIT_READ),
    (0, common_1.Controller)('admin/audit-logs'),
    __metadata("design:paramtypes", [audit_logs_service_1.AuditLogsService])
], AdminAuditLogsController);
//# sourceMappingURL=admin-overview.controllers.js.map