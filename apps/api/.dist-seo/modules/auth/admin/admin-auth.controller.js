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
exports.AdminAuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const current_user_decorator_1 = require("../../../common/decorators/current-user.decorator");
const public_decorator_1 = require("../../../common/decorators/public.decorator");
const app_exception_1 = require("../../../common/errors/app.exception");
const throttle_constants_1 = require("../../../common/throttle/throttle.constants");
const dto_1 = require("../dto");
const session_service_1 = require("../session/session.service");
const admin_auth_service_1 = require("./admin-auth.service");
/**
 * Back-office authentication. `@Public()` here only means "the global guard doesn't demand a
 * TOTP-verified session": the TOTP endpoints still require the pre-MFA admin session from login
 * (@CurrentAdmin → 401 without one).
 */
let AdminAuthController = class AdminAuthController {
    constructor(auth, sessions) {
        this.auth = auth;
        this.sessions = sessions;
    }
    login(dto, req, res) {
        return this.auth.login(dto, req, res);
    }
    csrf(req, res) {
        const session = req.authSession;
        if (!session || session.principal.kind !== 'ADMIN')
            throw app_exception_1.AppException.unauthenticated();
        this.sessions.setCsrfCookie(res, session.csrfToken);
        res.setHeader('Cache-Control', 'no-store');
        return { csrfToken: session.csrfToken };
    }
    /**
     * Starts TOTP enrollment (first login) or rotation (verified session + current password + current
     * code or recovery code in the body).
     */
    setup(admin, dto, req) {
        return this.auth.setupTotp(admin, dto, req);
    }
    activate(admin, dto, req, res) {
        return this.auth.activateTotp(admin, dto.code, req, res);
    }
    verify(admin, dto, req, res) {
        return this.auth.verifyTotp(admin, dto, req, res);
    }
    me(admin) {
        return this.auth.me(admin);
    }
    async logout(_admin, req, res) {
        await this.auth.logout(req, res);
    }
    changePassword(admin, dto, req, res) {
        return this.auth.changePassword(admin, dto, req, res);
    }
};
exports.AdminAuthController = AdminAuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.ADMIN_LOGIN),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AdminLoginDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminAuthController.prototype, "login", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('csrf'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Object)
], AdminAuthController.prototype, "csrf", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('totp/setup'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.ADMIN_LOGIN),
    __param(0, (0, current_user_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AdminTotpSetupDto, Object]),
    __metadata("design:returntype", Promise)
], AdminAuthController.prototype, "setup", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('totp/activate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.ADMIN_LOGIN),
    __param(0, (0, current_user_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AdminTotpActivateDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminAuthController.prototype, "activate", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('totp/verify'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.ADMIN_LOGIN),
    __param(0, (0, current_user_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AdminTotpVerifyDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminAuthController.prototype, "verify", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, current_user_decorator_1.CurrentAdmin)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminAuthController.prototype, "me", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, current_user_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminAuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)('password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.ADMIN_LOGIN),
    __param(0, (0, current_user_decorator_1.CurrentAdmin)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AdminPasswordChangeDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminAuthController.prototype, "changePassword", null);
exports.AdminAuthController = AdminAuthController = __decorate([
    (0, swagger_1.ApiTags)('admin-auth'),
    (0, common_1.Controller)('admin/auth'),
    __metadata("design:paramtypes", [admin_auth_service_1.AdminAuthService,
        session_service_1.SessionService])
], AdminAuthController);
//# sourceMappingURL=admin-auth.controller.js.map