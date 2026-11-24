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
exports.MembersService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../../../common/audit/audit.service");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const auth_1 = require("../../auth");
const listSelect = {
    id: true,
    nickname: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    status: true,
    createdAt: true,
    lastLoginAt: true,
    identities: { select: { provider: true } },
};
const detailSelect = {
    id: true,
    nickname: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    status: true,
    createdAt: true,
    lastLoginAt: true,
    marketingOptIn: true,
    suspendedAt: true,
    suspendedReason: true,
    withdrawnAt: true,
    withdrawalReason: true,
    piiScrubbedAt: true,
    identities: {
        select: { provider: true, createdAt: true, lastUsedAt: true },
        orderBy: { createdAt: 'asc' },
    },
    agencyMemberships: {
        select: {
            agencyId: true,
            role: true,
            status: true,
            agency: { select: { name: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
    },
    _count: { select: { dealRequests: true, reports: true, favoriteListings: true } },
};
/** What a member status change records in the audit log. */
const auditSelect = {
    id: true,
    status: true,
    suspendedAt: true,
    suspendedReason: true,
};
const iso = (d) => (d ? d.toISOString() : null);
/** "010-1234" / "5678" → digit search on the phone column; anything else → text search. */
function memberSearch(q) {
    const digits = (0, shared_1.normalizePhone)(q);
    const or = [
        { nickname: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
    ];
    if (/^[\d\s+()-]+$/.test(q) && digits.length >= 4)
        or.push({ phone: { contains: digits } });
    return { OR: or };
}
/** Member (site user) search, detail and suspension. */
let MembersService = class MembersService {
    constructor(prisma, sessions, audit) {
        this.prisma = prisma;
        this.sessions = sessions;
        this.audit = audit;
    }
    async list(q) {
        const where = {
            ...(q.status ? { status: q.status } : {}),
            ...(q.role ? { role: q.role } : {}),
            ...(q.q ? memberSearch(q.q) : {}),
        };
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.user.findMany({
            where,
            select: listSelect,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...args,
        }), () => this.prisma.user.count({ where }));
        return {
            ...page,
            items: page.items.map((u) => ({
                id: u.id,
                nickname: u.nickname,
                name: u.name,
                email: (0, shared_1.maskEmail)(u.email),
                phone: u.phone ? (0, shared_1.maskPhone)(u.phone) : null,
                role: u.role,
                status: u.status,
                providers: u.identities.map((i) => i.provider),
                createdAt: u.createdAt.toISOString(),
                lastLoginAt: iso(u.lastLoginAt),
            })),
        };
    }
    /**
     * Full member record, contacts unmasked. Viewing it is a 개인정보 접속기록 (안전성 확보조치 기준
     * 제8조: who, when, whose data, what), so it writes a `member.pii-view` audit row. The row names
     * the fields shown, never their values.
     */
    async detail(id) {
        const detail = await this.build(id);
        await this.audit.record({
            action: 'member.pii-view',
            resourceType: 'User',
            resourceId: id,
            after: { fields: ['name', 'email', 'phone'] },
        });
        return detail;
    }
    async build(id) {
        const u = await this.prisma.user.findUnique({ where: { id }, select: detailSelect });
        if (!u)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.MEMBER_NOT_FOUND);
        const sessions = await this.sessions.listForSubject('USER', id);
        return {
            id: u.id,
            nickname: u.nickname,
            name: u.name,
            email: u.email,
            phone: u.phone,
            role: u.role,
            status: u.status,
            createdAt: u.createdAt.toISOString(),
            lastLoginAt: iso(u.lastLoginAt),
            marketingOptIn: u.marketingOptIn,
            suspendedAt: iso(u.suspendedAt),
            suspendedReason: u.suspendedReason,
            withdrawnAt: iso(u.withdrawnAt),
            withdrawalReason: u.withdrawalReason,
            piiScrubbedAt: iso(u.piiScrubbedAt),
            identities: u.identities.map((i) => ({
                provider: i.provider,
                createdAt: i.createdAt.toISOString(),
                lastUsedAt: iso(i.lastUsedAt),
            })),
            memberships: u.agencyMemberships.map((m) => ({
                agencyId: m.agencyId,
                agencyName: m.agency.name,
                agencyStatus: m.agency.status,
                role: m.role,
                status: m.status,
            })),
            counts: {
                dealRequests: u._count.dealRequests,
                reports: u._count.reports,
                favoriteListings: u._count.favoriteListings,
            },
            activeSessions: sessions.length,
        };
    }
    /** ACTIVE → SUSPENDED and logout everywhere (OAuth login is refused while suspended). */
    async suspend(id, dto) {
        await this.transition(id, 'member.suspend', shared_1.UserStatus.ACTIVE, {
            status: shared_1.UserStatus.SUSPENDED,
            suspendedAt: new Date(),
            suspendedReason: dto.reason,
        });
        await this.sessions.destroyAllForSubject('USER', id);
        return this.maskedDetail(id);
    }
    async unsuspend(id) {
        await this.transition(id, 'member.unsuspend', shared_1.UserStatus.SUSPENDED, {
            status: shared_1.UserStatus.ACTIVE,
            suspendedAt: null,
            suspendedReason: null,
        });
        return this.maskedDetail(id);
    }
    /** Mutation responses mask contacts like the list does (the full record is GET /:id). */
    async maskedDetail(id) {
        const d = await this.build(id);
        return { ...d, email: (0, shared_1.maskEmail)(d.email), phone: d.phone ? (0, shared_1.maskPhone)(d.phone) : null };
    }
    /**
     * Status change + audit row in one transaction. The audit snapshots are a minimal projection
     * (no name, email, phone or withdrawal reason): audit_logs is append-only and never scrubbed.
     */
    async transition(id, action, from, data) {
        await this.prisma.$transaction(async (tx) => {
            const before = await tx.user.findUnique({ where: { id }, select: auditSelect });
            if (!before)
                throw app_exception_1.AppException.notFound(shared_1.ErrorCode.MEMBER_NOT_FOUND);
            if (before.status !== from)
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.MEMBER_INVALID_STATUS);
            const { count } = await tx.user.updateMany({ where: { id, status: from }, data });
            // Lost a race with another status change (withdrawal, a second operator).
            if (count === 0)
                throw app_exception_1.AppException.conflict(shared_1.ErrorCode.MEMBER_INVALID_STATUS);
            const after = await tx.user.findUniqueOrThrow({ where: { id }, select: auditSelect });
            await this.audit.record({ action, resourceType: 'User', resourceId: id, before, after }, tx);
        });
    }
};
exports.MembersService = MembersService;
exports.MembersService = MembersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        auth_1.SessionService,
        audit_service_1.AuditService])
], MembersService);
//# sourceMappingURL=members.service.js.map