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
exports.PrismaDealRequestAgencyDirectory = exports.DEAL_REQUEST_AGENCIES = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../constants");
exports.DEAL_REQUEST_AGENCIES = Symbol('DEAL_REQUEST_AGENCIES');
let PrismaDealRequestAgencyDirectory = class PrismaDealRequestAgencyDirectory {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async approvedSggCode(agencyId) {
        const row = await this.prisma.agency.findFirst({
            where: { id: agencyId, status: shared_1.AgencyStatus.APPROVED, deletedAt: null },
            select: { sggCode: true },
        });
        return row?.sggCode ?? null;
    }
    async approvedIds(ids, db = this.prisma) {
        if (ids.length === 0)
            return new Set();
        const rows = await db.agency.findMany({
            where: { id: { in: [...ids] }, status: shared_1.AgencyStatus.APPROVED, deletedAt: null },
            select: { id: true },
        });
        return new Set(rows.map((r) => r.id));
    }
    async names(ids) {
        if (ids.length === 0)
            return new Map();
        const rows = await this.prisma.agency.findMany({
            where: { id: { in: [...new Set(ids)] } },
            select: { id: true, name: true },
        });
        return new Map(rows.map((r) => [r.id, r.name]));
    }
    async memberRecipients(agencyIds, db = this.prisma) {
        if (agencyIds.length === 0)
            return [];
        const rows = await db.agencyMember.findMany({
            where: {
                agencyId: { in: [...agencyIds] },
                status: shared_1.AgencyMemberStatus.ACTIVE,
                user: { status: shared_1.UserStatus.ACTIVE },
            },
            select: { userId: true, agencyId: true },
            orderBy: { id: 'asc' },
        });
        return rows;
    }
    async regionMemberBatch(sggCode, after, db = this.prisma) {
        const rows = await db.agencyMember.findMany({
            where: {
                status: shared_1.AgencyMemberStatus.ACTIVE,
                user: { status: shared_1.UserStatus.ACTIVE },
                agency: { status: shared_1.AgencyStatus.APPROVED, deletedAt: null, sggCode },
                ...(after ? { id: { gt: after } } : {}),
            },
            select: { id: true, userId: true, agencyId: true },
            orderBy: { id: 'asc' },
            take: constants_1.JOB_BATCH_SIZE,
        });
        return {
            recipients: rows.map((r) => ({ userId: r.userId, agencyId: r.agencyId })),
            last: rows.length === constants_1.JOB_BATCH_SIZE ? (rows[rows.length - 1]?.id ?? null) : null,
        };
    }
};
exports.PrismaDealRequestAgencyDirectory = PrismaDealRequestAgencyDirectory;
exports.PrismaDealRequestAgencyDirectory = PrismaDealRequestAgencyDirectory = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PrismaDealRequestAgencyDirectory);
//# sourceMappingURL=agency-directory.port.js.map