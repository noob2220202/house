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
exports.AgenciesService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/errors/app.exception");
const prisma_service_1 = require("../../../prisma/prisma.service");
const agency_selects_1 = require("../agency.selects");
const agency_cache_service_1 = require("./agency-cache.service");
/**
 * Public surface of the agencies module for other modules (listings, deal-requests, admin):
 * membership checks, 표시·광고 disclosure data and warnings. Import AgenciesModule and inject this;
 * do not query agency tables directly.
 */
let AgenciesService = class AgenciesService {
    constructor(prisma, cache) {
        this.prisma = prisma;
        this.cache = cache;
    }
    /**
     * The user's ACTIVE membership in `agencyId`. Throws 403 AGENCY_MEMBERSHIP_REQUIRED when the
     * user is not an active member, AGENCY_NOT_APPROVED when the agency cannot act.
     */
    async assertActiveMember(userId, agencyId, opts = {}, db = this.prisma) {
        if (!agencyId)
            throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.AGENCY_MEMBERSHIP_REQUIRED);
        const member = await db.agencyMember.findUnique({
            where: { agencyId_userId: { agencyId, userId } },
            select: {
                id: true,
                role: true,
                status: true,
                displayName: true,
                phone: true,
                agency: { select: { status: true, deletedAt: true } },
            },
        });
        if (!member || member.status !== shared_1.AgencyMemberStatus.ACTIVE || member.agency.deletedAt) {
            throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.AGENCY_MEMBERSHIP_REQUIRED);
        }
        if (opts.requireOwner && member.role !== shared_1.AgencyMemberRole.OWNER) {
            throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.AGENCY_MEMBERSHIP_REQUIRED);
        }
        if ((opts.requireApproved ?? true) && member.agency.status !== shared_1.AgencyStatus.APPROVED) {
            throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.AGENCY_NOT_APPROVED);
        }
        return {
            memberId: member.id,
            agencyId,
            userId,
            role: member.role,
            displayName: member.displayName,
            phone: member.phone,
            agencyStatus: member.agency.status,
        };
    }
    /** An ACTIVE member of `agencyId` by member id (e.g. the contact person of a listing), or null. */
    async findActiveMember(agencyId, memberId) {
        return this.prisma.agencyMember.findFirst({
            where: { id: memberId, agencyId, status: shared_1.AgencyMemberStatus.ACTIVE },
            select: { id: true, displayName: true, phone: true },
        });
    }
    /** Whether the agency exists, is not deleted and is APPROVED. */
    async isApproved(agencyId) {
        const n = await this.prisma.agency.count({
            where: { id: agencyId, status: shared_1.AgencyStatus.APPROVED, deletedAt: null },
        });
        return n === 1;
    }
    /**
     * 표시·광고 명시사항 of an APPROVED agency (명칭·소재지·연락처·등록번호·대표자 성명), or null when the
     * agency cannot advertise. Listings feed this into the publish validator and the ad footer.
     */
    async getDisclosure(agencyId, db = this.prisma) {
        const row = await db.agency.findFirst({
            where: { id: agencyId, status: shared_1.AgencyStatus.APPROVED, deletedAt: null },
            select: agency_selects_1.disclosureSelect,
        });
        return row ? (0, shared_1.toAgencyDisclosure)(row) : null;
    }
    /** Batch variant (no N+1): agencyId → disclosure, APPROVED agencies only. */
    async getDisclosures(agencyIds) {
        const ids = [...new Set(agencyIds)];
        if (ids.length === 0)
            return new Map();
        const rows = await this.prisma.agency.findMany({
            where: { id: { in: ids }, status: shared_1.AgencyStatus.APPROVED, deletedAt: null },
            select: agency_selects_1.disclosureSelect,
        });
        return new Map(rows.map((r) => [r.id, (0, shared_1.toAgencyDisclosure)(r)]));
    }
    /**
     * Records a warning (e.g. a resolved 허위매물 report) and bumps the denormalized counter.
     * Pass `tx` to join the caller's transaction (the caller writes the audit log).
     */
    async recordWarning(input, tx) {
        const run = async (db) => {
            const agency = await db.agency.findFirst({
                where: { id: input.agencyId, deletedAt: null },
                select: { id: true, ownerUserId: true },
            });
            if (!agency)
                throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AGENCY_NOT_FOUND);
            const warning = await db.agencyWarning.create({
                data: {
                    agencyId: agency.id,
                    reason: input.reason,
                    reportId: input.reportId ?? null,
                    adminId: input.adminId ?? null,
                },
                select: { id: true },
            });
            await db.agency.update({
                where: { id: agency.id },
                data: { warningCount: { increment: 1 } },
            });
            await db.notification.create({
                data: {
                    userId: agency.ownerUserId,
                    type: shared_1.NotificationType.AGENCY_WARNED,
                    title: '중개사무소 경고 안내',
                    body: input.reason.slice(0, 1000),
                    data: { agencyId: agency.id, warningId: warning.id },
                },
            });
            return warning;
        };
        const warning = tx ? await run(tx) : await this.prisma.$transaction(run);
        await this.cache.invalidatePublic();
        return warning;
    }
};
exports.AgenciesService = AgenciesService;
exports.AgenciesService = AgenciesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        agency_cache_service_1.AgencyCacheService])
], AgenciesService);
//# sourceMappingURL=agencies.service.js.map