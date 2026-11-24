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
var AdminIpGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminIpGuard = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const session_resolver_1 = require("../../../common/auth/session-resolver");
const app_exception_1 = require("../../../common/errors/app.exception");
const app_config_service_1 = require("../../../config/app-config.service");
const ip_allowlist_1 = require("./ip-allowlist");
/**
 * Global guard (registered by AuthModule): when ADMIN_IP_ALLOWLIST is set, every /api/v1/admin/*
 * request — including the public login — must come from it. Per-account allowlists are enforced at
 * login and on every request by SessionService.resolve. Relies on Express `trust proxy` for req.ip.
 */
let AdminIpGuard = AdminIpGuard_1 = class AdminIpGuard {
    constructor(config) {
        this.logger = new common_1.Logger(AdminIpGuard_1.name);
        this.allowlist = new ip_allowlist_1.IpAllowlist(config.get('ADMIN_IP_ALLOWLIST'));
    }
    canActivate(context) {
        if (context.getType() !== 'http' || this.allowlist.size === 0)
            return true;
        const req = context.switchToHttp().getRequest();
        if (!(0, session_resolver_1.isAdminPath)(req))
            return true;
        if (this.allowlist.allows(req.ip))
            return true;
        this.logger.warn({ ip: req.ip, path: req.path }, 'admin request from a non-allowlisted IP');
        throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.AUTH_IP_NOT_ALLOWED);
    }
};
exports.AdminIpGuard = AdminIpGuard;
exports.AdminIpGuard = AdminIpGuard = AdminIpGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [app_config_service_1.AppConfig])
], AdminIpGuard);
//# sourceMappingURL=admin-ip.guard.js.map