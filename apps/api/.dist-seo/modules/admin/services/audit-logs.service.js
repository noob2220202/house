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
exports.AuditLogsService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const admin_mapper_1 = require("../admin.mapper");
/** Read side of the append-only audit log (written by AuditService / the audit interceptors). */
let AuditLogsService = class AuditLogsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(q) {
        const where = {
            ...(q.action
                ? q.action.endsWith('.')
                    ? { action: { startsWith: q.action } }
                    : { action: q.action }
                : {}),
            ...(q.actorType ? { actorType: q.actorType } : {}),
            ...(q.resourceType ? { resourceType: q.resourceType } : {}),
            ...(q.resourceId ? { resourceId: q.resourceId } : {}),
            ...(q.adminUserId ? { adminUserId: q.adminUserId } : {}),
            ...(q.from || q.to
                ? {
                    createdAt: {
                        ...(q.from ? { gte: new Date(q.from) } : {}),
                        ...(q.to ? { lt: new Date(q.to) } : {}),
                    },
                }
                : {}),
        };
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.auditLog.findMany({
            where,
            select: admin_mapper_1.auditLogSelect,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...args,
        }), () => this.prisma.auditLog.count({ where }));
        return { ...page, items: page.items.map(admin_mapper_1.toAuditLogView) };
    }
    async detail(id) {
        const row = await this.prisma.auditLog.findUnique({ where: { id }, select: admin_mapper_1.auditLogSelect });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AUDIT_LOG_NOT_FOUND);
        return (0, admin_mapper_1.toAuditLogView)(row);
    }
};
exports.AuditLogsService = AuditLogsService;
exports.AuditLogsService = AuditLogsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditLogsService);
//# sourceMappingURL=audit-logs.service.js.map