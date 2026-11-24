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
exports.UserSessionService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const prisma_service_1 = require("../../../prisma/prisma.service");
const session_service_1 = require("../session/session.service");
const ACTING_AGENCY_STATUSES = [
    shared_1.AgencyStatus.APPROVED,
    shared_1.AgencyStatus.PENDING,
    shared_1.AgencyStatus.SUSPENDED,
];
/** Starts site-user sessions and computes the agency a user acts for. */
let UserSessionService = class UserSessionService {
    constructor(prisma, sessions) {
        this.prisma = prisma;
        this.sessions = sessions;
    }
    /**
     * ACTIVE memberships of live (not rejected/deleted) agencies, APPROVED ones first. The first one
     * is the agency a new session acts for.
     */
    async activeMemberships(userId, db = this.prisma) {
        const rows = await db.agencyMember.findMany({
            where: {
                userId,
                status: shared_1.AgencyMemberStatus.ACTIVE,
                agency: { deletedAt: null, status: { in: ACTING_AGENCY_STATUSES } },
            },
            orderBy: { joinedAt: 'asc' },
            take: 10,
            select: { role: true, agency: { select: { id: true, name: true, status: true } } },
        });
        return rows
            .map((r) => ({
            agencyId: r.agency.id,
            agencyName: r.agency.name,
            agencyStatus: r.agency.status,
            memberRole: r.role,
        }))
            .sort((a, b) => Number(b.agencyStatus === shared_1.AgencyStatus.APPROVED) -
            Number(a.agencyStatus === shared_1.AgencyStatus.APPROVED));
    }
    async activeMembership(userId, db = this.prisma) {
        return (await this.activeMemberships(userId, db))[0] ?? null;
    }
    /** Issues a fresh session (dropping any session the browser already had: no fixation). */
    async start(req, res, user) {
        const previous = (0, session_service_1.readSessionCookie)(req, 'USER');
        if (previous)
            await this.sessions.destroy(previous);
        const membership = await this.activeMembership(user.id);
        const ua = req.headers['user-agent'];
        const { token, record } = await this.sessions.create({
            kind: 'USER',
            userId: user.id,
            role: user.role,
            agencyId: membership?.agencyId ?? null,
            ip: req.ip,
            userAgent: typeof ua === 'string' ? ua : undefined,
        });
        this.sessions.setCookies(res, 'USER', token, record);
        await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return record;
    }
};
exports.UserSessionService = UserSessionService;
exports.UserSessionService = UserSessionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        session_service_1.SessionService])
], UserSessionService);
//# sourceMappingURL=user-session.service.js.map