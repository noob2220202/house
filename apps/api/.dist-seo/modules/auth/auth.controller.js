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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const app_exception_1 = require("../../common/errors/app.exception");
const throttle_constants_1 = require("../../common/throttle/throttle.constants");
const dto_1 = require("./dto");
const oauth_registry_1 = require("./oauth/oauth-registry");
const oauth_state_store_1 = require("./oauth/oauth-state.store");
const session_service_1 = require("./session/session.service");
const signup_service_1 = require("./signup/signup.service");
const skip_terms_check_decorator_1 = require("./terms/skip-terms-check.decorator");
const account_service_1 = require("./users/account.service");
let AuthController = class AuthController {
    constructor(sessions, accounts, signup, registry) {
        this.sessions = sessions;
        this.accounts = accounts;
        this.signup = signup;
        this.registry = registry;
    }
    /** Enabled social login providers, for the login page. */
    providers() {
        return this.registry.enabled().map((p) => ({
            provider: p,
            slug: shared_1.AUTH_PROVIDER_SLUG[p],
            label: shared_1.AUTH_PROVIDER_LABEL[p],
        }));
    }
    /**
     * (Re-)issues the CSRF cookie and returns the token. With a session it is the session's token
     * (what CsrfGuard checks); without one a fresh random token is returned (nothing to protect yet).
     * Frontends should prefer the body value over reading the cookie.
     */
    csrf(req, res) {
        const csrfToken = req.authSession?.csrfToken ?? (0, oauth_state_store_1.randomToken)();
        this.sessions.setCsrfCookie(res, csrfToken);
        res.setHeader('Cache-Control', 'no-store');
        return { csrfToken };
    }
    me(user) {
        return this.accounts.me(user);
    }
    async logout(_user, req, res) {
        const token = (0, session_service_1.readSessionCookie)(req, 'USER');
        if (token)
            await this.sessions.destroy(token);
        this.sessions.clearCookies(res, 'USER');
    }
    async logoutAll(user, res) {
        const revoked = await this.sessions.destroyAllForSubject('USER', user.userId);
        this.sessions.clearCookies(res, 'USER');
        return { revoked };
    }
    /** Logged-in devices of the current user. */
    async listSessions(user) {
        const records = await this.sessions.listForSubject('USER', user.userId);
        return records.map((r) => ({
            id: r.id,
            current: r.id === user.sessionId,
            createdAt: new Date(r.createdAt).toISOString(),
            lastSeenAt: new Date(r.lastSeenAt).toISOString(),
            ip: r.ip,
            userAgent: r.userAgent,
        }));
    }
    async revokeSession(user, params, res) {
        const ok = await this.sessions.destroyForSubject('USER', user.userId, params.id);
        if (!ok)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AUTH_SESSION_NOT_FOUND);
        if (params.id === user.sessionId)
            this.sessions.clearCookies(res, 'USER');
    }
    /** Pending social signup (after the first OAuth callback): profile prefill + current terms. */
    pendingSignup(req) {
        return this.signup.describe(req);
    }
    completeSignup(dto, req, res) {
        return this.signup.complete(req, res, dto);
    }
    /**
     * 회원 탈퇴 of a suspended member (no session): authenticated by the `house_withdraw` ticket the
     * refused social login set (redirect `/login?error=AUTH_ACCOUNT_SUSPENDED&withdrawable=1`).
     * Logged-in members use POST /me/withdraw.
     */
    withdrawSuspended(dto, req, res) {
        return this.accounts.withdrawWithTicket(req, res, dto);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('providers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Array)
], AuthController.prototype, "providers", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('csrf'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Object)
], AuthController.prototype, "csrf", null);
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)('logout-all'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logoutAll", null);
__decorate([
    (0, common_1.Get)('sessions'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "listSessions", null);
__decorate([
    (0, common_1.Delete)('sessions/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.SessionIdParamDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "revokeSession", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('signup'),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.AUTH),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "pendingSignup", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('signup'),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.AUTH),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.SignupDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "completeSignup", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('withdraw'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.AUTH),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.WithdrawDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "withdrawSuspended", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('auth'),
    (0, common_1.Controller)('auth'),
    (0, skip_terms_check_decorator_1.SkipTermsCheck)(),
    __metadata("design:paramtypes", [session_service_1.SessionService,
        account_service_1.AccountService,
        signup_service_1.SignupService,
        oauth_registry_1.OAuthProviderRegistry])
], AuthController);
//# sourceMappingURL=auth.controller.js.map