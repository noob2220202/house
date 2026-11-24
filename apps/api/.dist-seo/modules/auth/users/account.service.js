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
exports.AccountService = void 0;
exports.toIdentitySummary = toIdentitySummary;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const app_exception_1 = require("../../../common/errors/app.exception");
const prisma_service_1 = require("../../../prisma/prisma.service");
const deal_request_maintenance_service_1 = require("../../deal-requests/services/deal-request-maintenance.service");
const listings_moderation_service_1 = require("../../listings/services/listings-moderation.service");
const auth_constants_1 = require("../auth.constants");
const session_service_1 = require("../session/session.service");
const terms_service_1 = require("../terms/terms.service");
const suspended_withdraw_store_1 = require("./suspended-withdraw.store");
const user_session_service_1 = require("./user-session.service");
const withdrawn_identity_service_1 = require("./withdrawn-identity.service");
function toIdentitySummary(i) {
    return {
        provider: i.provider,
        email: i.email,
        linkedAt: i.createdAt.toISOString(),
        lastUsedAt: i.lastUsedAt?.toISOString() ?? null,
    };
}
function toMe(user, agency, pendingRequiredTerms) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        nickname: user.nickname,
        phone: user.phone,
        profileImageUrl: user.profileImageUrl,
        role: user.role,
        status: user.status,
        marketingOptIn: user.marketingOptIn,
        marketingOptInAt: user.marketingOptIn && user.marketingOptInAt ? user.marketingOptInAt.toISOString() : null,
        createdAt: user.createdAt.toISOString(),
        identities: user.identities.map(toIdentitySummary),
        agency: agency
            ? {
                agencyId: agency.agencyId,
                agencyName: agency.agencyName,
                agencyStatus: agency.agencyStatus,
                memberRole: agency.memberRole,
            }
            : null,
        pendingRequiredTerms,
    };
}
/**
 * Opt-in flag + the start of the current opt-in: set when the member opts in from opted-out,
 * kept while they stay opted in (re-saving does not move it), cleared when they opt out.
 */
async function marketingOptInData(tx, userId, optIn) {
    if (!optIn)
        return { marketingOptIn: false, marketingOptInAt: null };
    const current = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { marketingOptIn: true, marketingOptInAt: true },
    });
    return current.marketingOptIn && current.marketingOptInAt
        ? { marketingOptIn: true }
        : { marketingOptIn: true, marketingOptInAt: new Date() };
}
/** The logged-in member's own account: profile, identities, consents, withdrawal. */
let AccountService = class AccountService {
    constructor(prisma, sessions, userSessions, terms, withdrawn, dealRequests, listings, suspendedWithdraw) {
        this.prisma = prisma;
        this.sessions = sessions;
        this.userSessions = userSessions;
        this.terms = terms;
        this.withdrawn = withdrawn;
        this.dealRequests = dealRequests;
        this.listings = listings;
        this.suspendedWithdraw = suspendedWithdraw;
    }
    /**
     * /me. Also self-heals the session: a deactivated account loses it (401), and role / acting
     * agency changes made elsewhere (agency approval, admin action) are written back to it.
     */
    async me(principal) {
        const user = await this.loadActive(principal);
        const memberships = await this.userSessions.activeMemberships(user.id);
        const agency = memberships.find((m) => m.agencyId === principal.agencyId) ?? memberships[0] ?? null;
        const agencyId = agency?.agencyId ?? null;
        if (user.role !== principal.role || agencyId !== principal.agencyId) {
            await this.sessions.updateById(principal.sessionId, { role: user.role, agencyId });
        }
        return toMe(user, agency, await this.terms.pendingRequired(user.id));
    }
    async updateProfile(principal, dto) {
        await this.loadActive(principal);
        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: principal.userId },
                data: {
                    ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
                    ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
                    ...(dto.marketingOptIn !== undefined
                        ? await marketingOptInData(tx, principal.userId, dto.marketingOptIn)
                        : {}),
                },
            });
            if (dto.marketingOptIn !== undefined) {
                // The opt-in flag and the consent history must agree (정보통신망법 수신동의 기록).
                const marketing = (await this.terms.current(new Date(), tx)).find((d) => d.type === shared_1.TermsType.MARKETING);
                if (marketing) {
                    await this.terms.record(tx, principal.userId, [
                        { termsDocumentId: marketing.id, agreed: dto.marketingOptIn },
                    ]);
                }
            }
        });
        return this.me(principal);
    }
    async identities(principal) {
        const rows = await this.prisma.identity.findMany({
            where: { userId: principal.userId },
            orderBy: { createdAt: 'asc' },
        });
        return rows.map(toIdentitySummary);
    }
    /** Unlinks a provider; the last identity can't go (social login is the only way in). */
    async unlink(principal, provider) {
        await this.prisma.$transaction(async (tx) => {
            const rows = await tx.identity.findMany({
                where: { userId: principal.userId },
                select: { id: true, provider: true },
            });
            const target = rows.find((r) => r.provider === provider);
            if (!target)
                throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AUTH_IDENTITY_NOT_FOUND);
            if (rows.length <= 1)
                throw app_exception_1.AppException.conflict(shared_1.ErrorCode.AUTH_LAST_IDENTITY);
            await tx.identity.delete({ where: { id: target.id } });
        });
        return this.identities(principal);
    }
    consents(principal) {
        return this.terms.status(principal.userId);
    }
    async updateConsents(principal, dto) {
        await this.loadActive(principal);
        await this.prisma.$transaction(async (tx) => {
            const current = await this.terms.current(new Date(), tx);
            const byId = this.terms.validate(current, dto.consents, { requireAll: false });
            await this.terms.record(tx, principal.userId, dto.consents);
            const marketing = dto.consents.find((c) => byId.get(c.termsDocumentId)?.type === shared_1.TermsType.MARKETING);
            if (marketing) {
                await tx.user.update({
                    where: { id: principal.userId },
                    data: await marketingOptInData(tx, principal.userId, marketing.agreed),
                });
            }
        });
        return this.terms.status(principal.userId);
    }
    /**
     * 회원 탈퇴 from a logged-in session: see withdrawUser. Logs out everywhere afterwards.
     */
    async withdraw(principal, dto, res) {
        await this.withdrawUser(principal.userId, dto);
        this.sessions.clearCookies(res, 'USER');
    }
    /**
     * 회원 탈퇴: soft delete now (status, sessions, identities, agency memberships), PII scrubbed by
     * the PII scrub job after PII_SCRUB_DELAY_DAYS. Identities are removed at once, but a tombstone
     * keeps the same social account from signing up again for REJOIN_COOLDOWN_DAYS. 내놓기/구하기
     * requests are cancelled and erased (contact, 동·호, address, position, photos) in the same
     * transaction by the deal-requests module, so no agency can reveal them after this point;
     * agencies with live proposals are notified after commit.
     * A suspended member may withdraw too (deletion / 처리정지 rights are not suspended): their PII is
     * then kept for SUSPENDED_PII_RETENTION_DAYS and the rejoin cooldown is as long; reports, audit
     * rows and suspendedReason stay as moderation evidence until the scrub.
     */
    async withdrawUser(userId, dto) {
        const now = new Date();
        const { notices, relinked } = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { status: true },
            });
            if (!user || (user.status !== shared_1.UserStatus.ACTIVE && user.status !== shared_1.UserStatus.SUSPENDED)) {
                throw app_exception_1.AppException.unauthenticated();
            }
            const retentionDays = user.status === shared_1.UserStatus.SUSPENDED ? auth_constants_1.SUSPENDED_PII_RETENTION_DAYS : auth_constants_1.PII_SCRUB_DELAY_DAYS;
            const ownsAgency = await tx.agency.count({
                where: {
                    ownerUserId: userId,
                    deletedAt: null,
                    status: { in: [shared_1.AgencyStatus.PENDING, shared_1.AgencyStatus.APPROVED, shared_1.AgencyStatus.SUSPENDED] },
                },
            });
            if (ownsAgency > 0)
                throw app_exception_1.AppException.conflict(shared_1.ErrorCode.AUTH_WITHDRAW_AGENCY_OWNER);
            const relinked = await this.detachMemberships(tx, userId, now);
            const identities = await tx.identity.findMany({
                where: { userId },
                select: { provider: true, providerUserId: true },
            });
            await this.withdrawn.record(tx, userId, identities, now, {
                cooldownDays: user.status === shared_1.UserStatus.SUSPENDED ? auth_constants_1.SUSPENDED_PII_RETENTION_DAYS : undefined,
            });
            await tx.identity.deleteMany({ where: { userId } });
            const dealRequestNotices = await this.dealRequests.scrubUser(userId, now, tx);
            await tx.user.update({
                where: { id: userId },
                data: {
                    status: shared_1.UserStatus.WITHDRAWN,
                    withdrawnAt: now,
                    withdrawalReason: dto.reason ?? null,
                    marketingOptIn: false,
                    marketingOptInAt: null,
                    piiScrubAfter: new Date(now.getTime() + retentionDays * 86_400_000),
                },
            });
            return { notices: dealRequestNotices, relinked };
        });
        await this.sessions.destroyAllForSubject('USER', userId);
        await this.dealRequests.dispatch(notices);
        if (relinked > 0)
            await this.listings.invalidateSearch();
    }
    /**
     * Ends every agency membership and takes the member's name/phone off the listing ads they were
     * the contact for (moved to the office's 대표). Returns the number of listing links changed.
     */
    async detachMemberships(tx, userId, now) {
        const memberships = await tx.agencyMember.findMany({
            where: { userId, status: { not: shared_1.AgencyMemberStatus.REMOVED } },
            select: { id: true, agencyId: true },
        });
        if (memberships.length === 0)
            return 0;
        await tx.agencyMember.updateMany({
            where: { id: { in: memberships.map((m) => m.id) } },
            data: { status: shared_1.AgencyMemberStatus.REMOVED, removedAt: now },
        });
        let relinked = 0;
        for (const m of memberships) {
            relinked += await this.listings.memberDeparted(tx, m.agencyId, m.id);
        }
        return relinked;
    }
    /**
     * POST /auth/withdraw: withdrawal of a suspended member, who has no session. Authenticated by the
     * ticket the refused social login issued (SuspendedWithdrawStore); 401 without a live one.
     * The ticket is spent only on success, so a 409 (still owns an agency) can be retried.
     */
    async withdrawWithTicket(req, res, dto) {
        const cookies = req.cookies;
        const token = cookies?.[auth_constants_1.AUTH_COOKIES.SUSPENDED_WITHDRAW];
        const userId = await this.suspendedWithdraw.get(token);
        if (!token || !userId)
            throw app_exception_1.AppException.unauthenticated();
        await this.withdrawUser(userId, dto);
        await this.suspendedWithdraw.delete(token);
        res.clearCookie(auth_constants_1.AUTH_COOKIES.SUSPENDED_WITHDRAW, {
            ...this.sessions.baseCookie(),
            httpOnly: true,
            path: auth_constants_1.AUTH_COOKIE_PATHS.SUSPENDED_WITHDRAW,
        });
    }
    async loadActive(principal) {
        const user = await this.prisma.user.findUnique({
            where: { id: principal.userId },
            include: { identities: { orderBy: { createdAt: 'asc' } } },
        });
        if (!user || user.status !== shared_1.UserStatus.ACTIVE) {
            await this.sessions.destroyAllForSubject('USER', principal.userId);
            throw app_exception_1.AppException.unauthenticated(user?.status === shared_1.UserStatus.SUSPENDED
                ? shared_1.ErrorCode.AUTH_ACCOUNT_SUSPENDED
                : shared_1.ErrorCode.UNAUTHENTICATED);
        }
        return user;
    }
};
exports.AccountService = AccountService;
exports.AccountService = AccountService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        session_service_1.SessionService,
        user_session_service_1.UserSessionService,
        terms_service_1.TermsService,
        withdrawn_identity_service_1.WithdrawnIdentityService,
        deal_request_maintenance_service_1.DealRequestMaintenanceService,
        listings_moderation_service_1.ListingsModerationService,
        suspended_withdraw_store_1.SuspendedWithdrawStore])
], AccountService);
//# sourceMappingURL=account.service.js.map