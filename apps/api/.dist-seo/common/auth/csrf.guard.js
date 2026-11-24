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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CsrfGuard = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const shared_1 = require("@house/shared");
const app_config_service_1 = require("../../config/app-config.service");
const metadata_keys_1 = require("../decorators/metadata-keys");
const app_exception_1 = require("../errors/app.exception");
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
/**
 * Global CSRF guard for state-changing requests (runs after AuthGuard):
 *  1. If Origin (or Referer) is present it must be in the allowlist.
 *  2. If the request is authenticated by a session cookie, the `x-csrf-token` header must equal
 *     the session's CSRF token (the token is also readable by the frontend in the house_csrf cookie).
 * Requests without a session carry no ambient credentials, so (2) does not apply to them.
 */
let CsrfGuard = class CsrfGuard {
    constructor(reflector, config) {
        this.reflector = reflector;
        this.allowed = new Set(config.allowedOrigins);
    }
    canActivate(context) {
        if (context.getType() !== 'http')
            return true;
        const req = context.switchToHttp().getRequest();
        if (SAFE_METHODS.has(req.method))
            return true;
        const skip = this.reflector.getAllAndOverride(metadata_keys_1.SKIP_CSRF_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (skip)
            return true;
        const origin = this.requestOrigin(req);
        if (origin !== null && !this.allowed.has(origin))
            throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.CSRF_FAILED);
        if (req.authSession) {
            const header = req.headers[shared_1.HEADER_NAMES.CSRF];
            if (typeof header !== 'string' || !safeEqual(header, req.authSession.csrfToken)) {
                throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.CSRF_FAILED);
            }
        }
        return true;
    }
    requestOrigin(req) {
        const origin = req.headers.origin;
        if (typeof origin === 'string' && origin !== 'null')
            return origin;
        if (origin === 'null')
            return 'null';
        const referer = req.headers.referer;
        if (typeof referer === 'string') {
            try {
                return new URL(referer).origin;
            }
            catch {
                return 'invalid';
            }
        }
        return null;
    }
};
exports.CsrfGuard = CsrfGuard;
exports.CsrfGuard = CsrfGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        app_config_service_1.AppConfig])
], CsrfGuard);
function safeEqual(a, b) {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && (0, node_crypto_1.timingSafeEqual)(ab, bb);
}
//# sourceMappingURL=csrf.guard.js.map