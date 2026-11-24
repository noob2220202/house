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
exports.AuthGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const shared_1 = require("@house/shared");
const request_context_1 = require("../context/request-context");
const metadata_keys_1 = require("../decorators/metadata-keys");
const app_exception_1 = require("../errors/app.exception");
const session_resolver_1 = require("./session-resolver");
/**
 * Global guard. Resolves the session (if any) onto req.principal, then:
 *  - non-@Public routes require a principal (401)
 *  - /api/v1/admin/* requires an ADMIN principal with TOTP verified (401)
 *  - @Roles(...) requires principal.role ∈ roles (403)
 * Resource ownership is NOT checked here — services must check it (no IDOR).
 */
let AuthGuard = class AuthGuard {
    constructor(reflector, sessions) {
        this.reflector = reflector;
        this.sessions = sessions;
    }
    async canActivate(context) {
        if (context.getType() !== 'http')
            return true;
        const req = context.switchToHttp().getRequest();
        const targets = [context.getHandler(), context.getClass()];
        const isPublic = this.reflector.getAllAndOverride(metadata_keys_1.IS_PUBLIC_KEY, targets) ?? false;
        const roles = this.reflector.getAllAndOverride(metadata_keys_1.ROLES_KEY, targets);
        const session = await (0, session_resolver_1.resolveSessionOnce)(req, this.sessions);
        if (session) {
            req.authSession = session;
            req.principal = session.principal;
            const ctx = request_context_1.RequestContext.current();
            if (ctx)
                ctx.principal = session.principal;
        }
        const principal = req.principal;
        if ((0, session_resolver_1.isAdminPath)(req) && !isPublic) {
            if (principal?.kind !== 'ADMIN')
                throw app_exception_1.AppException.unauthenticated();
            if (!principal.mfaVerified)
                throw app_exception_1.AppException.unauthenticated(shared_1.ErrorCode.AUTH_TOTP_REQUIRED);
        }
        if (!principal) {
            if (isPublic)
                return true;
            throw app_exception_1.AppException.unauthenticated();
        }
        if (roles && roles.length > 0) {
            if (!roles.includes(principal.role))
                throw app_exception_1.AppException.forbidden();
            const adminOnly = roles.every((r) => shared_1.ADMIN_ROLES.includes(r));
            if (adminOnly && principal.kind !== 'ADMIN')
                throw app_exception_1.AppException.forbidden();
        }
        return true;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(session_resolver_1.SESSION_RESOLVER)),
    __metadata("design:paramtypes", [core_1.Reflector, Object])
], AuthGuard);
//# sourceMappingURL=auth.guard.js.map