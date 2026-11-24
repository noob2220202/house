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
exports.PrismaAgencyMembership = exports.LISTING_AGENCY_MEMBERSHIP = void 0;
exports.mayBeAdvertised = mayBeAdvertised;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/errors/app.exception");
const prisma_service_1 = require("../../../prisma/prisma.service");
/** 개업공인중개사(OWNER) or 소속공인중개사 — the only people a listing ad may name (제18조의2①). */
function mayBeAdvertised(m) {
    return m.role === shared_1.AgencyMemberRole.OWNER || m.isLicensed;
}
const MEMBER_REF_SELECT = {
    id: true,
    displayName: true,
    phone: true,
    role: true,
    isLicensed: true,
};
exports.LISTING_AGENCY_MEMBERSHIP = Symbol('LISTING_AGENCY_MEMBERSHIP');
let PrismaAgencyMembership = class PrismaAgencyMembership {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async resolveActor(principal) {
        if (!principal.agencyId)
            throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.LISTING_NOT_AGENCY_MEMBER);
        const member = await this.prisma.agencyMember.findUnique({
            where: { agencyId_userId: { agencyId: principal.agencyId, userId: principal.userId } },
            select: {
                ...MEMBER_REF_SELECT,
                status: true,
                agency: { select: { status: true, deletedAt: true } },
            },
        });
        if (!member || member.status !== shared_1.AgencyMemberStatus.ACTIVE) {
            throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.LISTING_NOT_AGENCY_MEMBER);
        }
        if (member.agency.status !== shared_1.AgencyStatus.APPROVED || member.agency.deletedAt) {
            throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.LISTING_AGENCY_NOT_ACTIVE);
        }
        return {
            userId: principal.userId,
            agencyId: principal.agencyId,
            memberId: member.id,
            displayName: member.displayName,
            phone: member.phone,
            role: member.role,
            isLicensed: member.isLicensed,
        };
    }
    async findActiveMember(agencyId, memberId) {
        return this.prisma.agencyMember.findFirst({
            where: { id: memberId, agencyId, status: shared_1.AgencyMemberStatus.ACTIVE },
            select: MEMBER_REF_SELECT,
        });
    }
    async findRepresentative(agencyId) {
        return this.prisma.agencyMember.findFirst({
            where: { agencyId, role: shared_1.AgencyMemberRole.OWNER, status: shared_1.AgencyMemberStatus.ACTIVE },
            orderBy: { joinedAt: 'asc' },
            select: MEMBER_REF_SELECT,
        });
    }
};
exports.PrismaAgencyMembership = PrismaAgencyMembership;
exports.PrismaAgencyMembership = PrismaAgencyMembership = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PrismaAgencyMembership);
//# sourceMappingURL=agency-membership.port.js.map