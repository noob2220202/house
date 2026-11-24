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
var AuditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
exports.sanitizeForAudit = sanitizeForAudit;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const principal_1 = require("../auth/principal");
const request_context_1 = require("../context/request-context");
const REDACTED_KEYS = new Set([
    'passwordHash',
    'password',
    'totpSecretEnc',
    'recoveryCodeHashes',
    'contactPhone',
    'phone',
    'ho',
    'reporterPhone',
    'email',
    'withdrawalReason',
]);
/** Strips secrets/PII and converts to JSON-safe values (Decimal/Date/BigInt). */
function sanitizeForAudit(value, depth = 0) {
    if (value === null || value === undefined)
        return null;
    if (depth > 6)
        return '[depth]';
    if (value instanceof Date)
        return value.toISOString();
    if (typeof value === 'bigint')
        return value.toString();
    if (client_1.Prisma.Decimal.isDecimal(value))
        return value.toString();
    if (Array.isArray(value))
        return value.slice(0, 200).map((v) => sanitizeForAudit(v, depth + 1));
    if (typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = REDACTED_KEYS.has(k)
                ? v == null
                    ? null
                    : '[redacted]'
                : sanitizeForAudit(v, depth + 1);
        }
        return out;
    }
    if (typeof value === 'string')
        return value.length > 5000 ? `${value.slice(0, 5000)}…` : value;
    if (typeof value === 'number' || typeof value === 'boolean')
        return value;
    return null;
}
let AuditService = AuditService_1 = class AuditService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(AuditService_1.name);
    }
    /** Writes an audit row. Pass `tx` to make it part of the mutation's transaction. */
    async record(input, tx) {
        const ctx = request_context_1.RequestContext.current();
        const principal = ctx?.principal;
        const actorType = input.actorType ??
            ((0, principal_1.isAdminPrincipal)(principal)
                ? shared_1.AuditActorType.ADMIN
                : principal
                    ? shared_1.AuditActorType.USER
                    : shared_1.AuditActorType.SYSTEM);
        const db = tx ?? this.prisma;
        await db.auditLog.create({
            data: {
                actorType,
                adminUserId: (0, principal_1.isAdminPrincipal)(principal) ? principal.adminId : null,
                userId: (0, principal_1.isUserPrincipal)(principal) ? principal.userId : null,
                action: input.action,
                resourceType: input.resourceType,
                resourceId: input.resourceId ?? null,
                before: sanitizeForAudit(input.before) ?? client_1.Prisma.JsonNull,
                after: sanitizeForAudit(input.after) ?? client_1.Prisma.JsonNull,
                ip: ctx?.ip ?? null,
                userAgent: ctx?.userAgent ?? null,
                requestId: ctx?.requestId ?? null,
            },
        });
        // Inside a transaction this marks the row as written before commit; if the transaction rolls
        // back the handler fails too, and the admin safety net only runs after a successful handler.
        if (ctx)
            ctx.auditWritten = true;
    }
    /** Fire-and-forget variant for non-transactional paths; failures are logged, never thrown. */
    recordSafe(input) {
        this.record(input).catch((err) => this.logger.error({ err, action: input.action }, 'failed to write audit log'));
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = AuditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditService);
//# sourceMappingURL=audit.service.js.map