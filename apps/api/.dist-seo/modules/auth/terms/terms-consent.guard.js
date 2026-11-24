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
exports.TermsConsentGuard = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const shared_1 = require("@house/shared");
const principal_1 = require("../../../common/auth/principal");
const app_exception_1 = require("../../../common/errors/app.exception");
const redis_constants_1 = require("../../../redis/redis.constants");
const auth_constants_1 = require("../auth.constants");
const skip_terms_check_decorator_1 = require("./skip-terms-check.decorator");
const terms_service_1 = require("./terms.service");
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
/**
 * Global guard (registered by AuthModule, runs after AuthGuard): a member who has not agreed to the
 * current version of every required terms document cannot make state-changing requests
 * (403 AUTH_TERMS_REQUIRED, details.missing = the pending types) until they POST /me/consents.
 * Reads stay open, and routes marked @SkipTermsCheck() (auth, own account, consents, withdrawal)
 * stay usable. Admin sessions are not affected.
 *
 * Only a positive result is cached, keyed by the set of current required document ids: a newly
 * effective version changes the key, so nothing has to be invalidated on publish or on consent,
 * and required consents cannot be revoked, so a cached "ok" cannot go stale.
 */
let TermsConsentGuard = class TermsConsentGuard {
    constructor(reflector, terms, redis) {
        this.reflector = reflector;
        this.terms = terms;
        this.redis = redis;
    }
    async canActivate(context) {
        if (context.getType() !== 'http')
            return true;
        const req = context.switchToHttp().getRequest();
        if (SAFE_METHODS.has(req.method))
            return true;
        const principal = req.principal;
        if (!(0, principal_1.isUserPrincipal)(principal))
            return true;
        const skip = this.reflector.getAllAndOverride(skip_terms_check_decorator_1.SKIP_TERMS_CHECK_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (skip)
            return true;
        const required = (await this.terms.current()).filter((d) => d.isRequired);
        if (required.length === 0)
            return true;
        const digest = (0, node_crypto_1.createHash)('sha256')
            .update(required
            .map((d) => d.id)
            .sort()
            .join(','))
            .digest('hex')
            .slice(0, 32);
        const key = auth_constants_1.REDIS_KEYS.termsConsentOk(principal.userId, digest);
        if ((await this.redis.get(key)) !== null)
            return true;
        const missing = await this.terms.pendingRequired(principal.userId, required);
        if (missing.length === 0) {
            await this.redis.set(key, '1', 'EX', auth_constants_1.TERMS_CONSENT_OK_TTL_SECONDS);
            return true;
        }
        throw new app_exception_1.AppException(shared_1.ErrorCode.AUTH_TERMS_REQUIRED, {
            status: common_1.HttpStatus.FORBIDDEN,
            details: { missing },
        });
    }
};
exports.TermsConsentGuard = TermsConsentGuard;
exports.TermsConsentGuard = TermsConsentGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(redis_constants_1.REDIS)),
    __metadata("design:paramtypes", [core_1.Reflector,
        terms_service_1.TermsService, Function])
], TermsConsentGuard);
//# sourceMappingURL=terms-consent.guard.js.map