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
exports.AuditInterceptor = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const rxjs_1 = require("rxjs");
const request_context_1 = require("../context/request-context");
const metadata_keys_1 = require("../decorators/metadata-keys");
const audit_service_1 = require("./audit.service");
/**
 * Global interceptor; active only on handlers decorated with @Audit(...).
 * After success it writes { action, resourceType, resourceId, before, after } where
 * `before` comes from RequestContext.setAuditBefore() (call it in the service before mutating)
 * and `after` is the handler's response body.
 * For multi-step mutations prefer AuditService.record(..., tx) inside the transaction.
 */
let AuditInterceptor = class AuditInterceptor {
    constructor(reflector, audit) {
        this.reflector = reflector;
        this.audit = audit;
    }
    intercept(context, next) {
        const options = this.reflector.get(metadata_keys_1.AUDIT_KEY, context.getHandler());
        if (!options || context.getType() !== 'http')
            return next.handle();
        const req = context.switchToHttp().getRequest();
        return next.handle().pipe((0, rxjs_1.mergeMap)((result) => (0, rxjs_1.from)((async () => {
            const param = req.params[options.idParam ?? 'id'];
            const resultId = typeof result === 'object' && result !== null && 'id' in result
                ? String(result.id)
                : undefined;
            await this.audit.record({
                action: options.action,
                resourceType: options.resourceType,
                resourceId: typeof param === 'string' ? param : resultId,
                before: request_context_1.RequestContext.current()?.auditBefore,
                after: result,
            });
            return result;
        })())));
    }
};
exports.AuditInterceptor = AuditInterceptor;
exports.AuditInterceptor = AuditInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        audit_service_1.AuditService])
], AuditInterceptor);
//# sourceMappingURL=audit.interceptor.js.map