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
var AdminMutationAuditInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminMutationAuditInterceptor = exports.MUTATING_METHODS = void 0;
exports.stripSecrets = stripSecrets;
exports.resourceTypeFromPath = resourceTypeFromPath;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const constants_1 = require("@nestjs/common/constants");
const rxjs_1 = require("rxjs");
const audit_service_1 = require("../../../common/audit/audit.service");
const session_resolver_1 = require("../../../common/auth/session-resolver");
const request_context_1 = require("../../../common/context/request-context");
const metadata_keys_1 = require("../../../common/decorators/metadata-keys");
exports.MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** Response fields that must never reach the audit log (tokens, TOTP enrolment material …). */
const SECRET_KEYS = new Set([
    'csrfToken',
    'token',
    'secret',
    'otpauthUrl',
    'qrCodeDataUrl',
    'recoveryCodes',
    'password',
    'newPassword',
    'currentPassword',
]);
function stripSecrets(value, depth = 0) {
    if (depth > 6 || value === null || typeof value !== 'object')
        return value;
    if (value instanceof Date)
        return value;
    if (Array.isArray(value))
        return value.map((v) => stripSecrets(v, depth + 1));
    const out = {};
    for (const [k, v] of Object.entries(value)) {
        out[k] = SECRET_KEYS.has(k) ? (v == null ? null : '[redacted]') : stripSecrets(v, depth + 1);
    }
    return out;
}
/** "admin/agencies" → "agencies", "admin/complexes/trade-sync" → "complexes.trade-sync". */
function resourceTypeFromPath(controllerPath) {
    const path = Array.isArray(controllerPath) ? (controllerPath[0] ?? '') : (controllerPath ?? '');
    const parts = path
        .split('/')
        .filter((p) => p && !p.startsWith(':'))
        .slice(1);
    return (parts.join('.') || 'admin').slice(0, 50);
}
/**
 * Safety net behind @Audit: every successful mutation under /api/v1/admin/** ends up in the
 * audit log, whichever module owns the route. Handlers with @Audit are left to AuditInterceptor;
 * for the others, if the handler did not write an audit row itself (AuditService.record(…, tx)
 * flags the request context), a generic row `auto:<resource>.<handler>` is written with the route
 * params and the (secret-stripped, PII-redacted) response body. The flag lives in this request's
 * AsyncLocalStorage store, so a client-chosen x-request-id shared by other calls cannot hide a
 * mutation.
 */
let AdminMutationAuditInterceptor = AdminMutationAuditInterceptor_1 = class AdminMutationAuditInterceptor {
    constructor(reflector, audit) {
        this.reflector = reflector;
        this.audit = audit;
        this.logger = new common_1.Logger(AdminMutationAuditInterceptor_1.name);
    }
    intercept(context, next) {
        if (context.getType() !== 'http')
            return next.handle();
        const req = context.switchToHttp().getRequest();
        const fallback = exports.MUTATING_METHODS.has(req.method) &&
            (0, session_resolver_1.isAdminPath)(req) &&
            !this.reflector.get(metadata_keys_1.AUDIT_KEY, context.getHandler());
        if (!fallback)
            return next.handle();
        const resourceType = resourceTypeFromPath(this.reflector.get(constants_1.PATH_METADATA, context.getClass()));
        const action = `auto:${resourceType}.${context.getHandler().name}`.slice(0, 100);
        return next
            .handle()
            .pipe((0, rxjs_1.mergeMap)((result) => (0, rxjs_1.from)(this.recordIfMissing(req, { action, resourceType }, result))));
    }
    async recordIfMissing(req, meta, result) {
        try {
            if (request_context_1.RequestContext.current()?.auditWritten)
                return result;
            const param = req.params.id;
            const resultId = typeof result === 'object' && result !== null && 'id' in result
                ? String(result.id)
                : undefined;
            await this.audit.record({
                action: meta.action,
                resourceType: meta.resourceType,
                resourceId: (typeof param === 'string' ? param : resultId)?.slice(0, 64),
                before: request_context_1.RequestContext.current()?.auditBefore,
                after: { params: { ...req.params }, response: stripSecrets(result) },
            });
        }
        catch (err) {
            // The mutation already committed; a failed audit write is logged loudly, not turned into a 500.
            this.logger.error({ err, action: meta.action }, 'fallback audit write failed');
        }
        return result;
    }
};
exports.AdminMutationAuditInterceptor = AdminMutationAuditInterceptor;
exports.AdminMutationAuditInterceptor = AdminMutationAuditInterceptor = AdminMutationAuditInterceptor_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        audit_service_1.AuditService])
], AdminMutationAuditInterceptor);
//# sourceMappingURL=admin-mutation-audit.interceptor.js.map