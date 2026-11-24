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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgencyMembersService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const auth_1 = require("../../auth");
const agency_mapper_1 = require("../agency.mapper");
const agency_selects_1 = require("../agency.selects");
const constants_1 = require("../constants");
const locks_1 = require("../domain/locks");
const agency_listings_sync_1 = require("../ports/agency-listings.sync");
const agency_cache_service_1 = require("./agency-cache.service");
const agency_invite_store_1 = require("./agency-invite.store");
const agency_session_sync_service_1 = require("./agency-session-sync.service");
const liveMembershipWhere = (userId) => ({
    userId,
    status: shared_1.AgencyMemberStatus.ACTIVE,
    agency: { deletedAt: null, status: { in: [...shared_1.LIVE_AGENCY_STATUSES] } },
});
/**
 * 소속 중개사 관리: the owner issues single-use invite codes, a user redeems one to join as AGENT,
 * the owner edits / removes staff, an agent may leave. Removing or leaving downgrades the user to
 * USER and updates live sessions.
 */
let AgencyMembersService = class AgencyMembersService {
    constructor(prisma, invites, cache, sessions, terms, listings) {
        this.prisma = prisma;
        this.invites = invites;
        this.cache = cache;
        this.sessions = sessions;
        this.terms = terms;
        this.listings = listings;
    }
    async list(user, q) {
        const agencyId = await this.managedAgencyId(user.userId);
        const where = {
            agencyId,
            ...(q.includeRemoved ? {} : { status: shared_1.AgencyMemberStatus.ACTIVE }),
        };
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.agencyMember.findMany({
            where,
            select: agency_selects_1.agencyMemberSelect,
            // OWNER sorts before AGENT (enum order), then by join date.
            orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }, { id: 'asc' }],
            ...args,
        }), () => this.prisma.agencyMember.count({ where }));
        return { ...page, items: page.items.map(agency_mapper_1.toMemberView) };
    }
    /**
     * Owner edits a staff member. Listing ads copy the contact's name and phone onto each
     * ListingAgency row, so the change is carried there in the same transaction: a member who is no
     * longer advertisable (license flag cleared) is taken off the ads like a departure (contact moves
     * to the 대표), and a rename / new phone of an advertisable member updates their ads (phone only
     * where the row still shows the old member phone, i.e. was not overridden per listing).
     */
    async update(user, memberId, input) {
        const agencyId = await this.managedAgencyId(user.userId);
        const { updated, relinked } = await this.prisma.$transaction(async (tx) => {
            await (0, locks_1.lockAgency)(tx, agencyId);
            const member = await this.findMember(agencyId, memberId, tx);
            const isLicensed = input.isLicensed ?? member.isLicensed;
            // A 중개보조원 has no license number; a 소속공인중개사 must have one (the 대표 is the
            // 개업공인중개사 whose 등록 already covers it).
            const licenseNumber = isLicensed
                ? input.licenseNumber !== undefined
                    ? input.licenseNumber
                    : member.licenseNumber
                : null;
            if (isLicensed && !licenseNumber && member.role !== shared_1.AgencyMemberRole.OWNER) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AGENCY_LICENSE_NUMBER_REQUIRED);
            }
            const row = await tx.agencyMember.update({
                where: { id: member.id },
                data: {
                    displayName: input.displayName,
                    title: input.title,
                    phone: input.phone,
                    isLicensed: input.isLicensed,
                    licenseNumber,
                },
                select: agency_selects_1.agencyMemberSelect,
            });
            let changed = 0;
            if ((0, shared_1.isAdvertisableMember)(member) && !(0, shared_1.isAdvertisableMember)(row)) {
                changed = await this.listings.memberDeparted(tx, agencyId, member.id);
            }
            else if ((0, shared_1.isAdvertisableMember)(row)) {
                if (row.displayName !== member.displayName) {
                    const r = await tx.listingAgency.updateMany({
                        where: { agencyId, contactMemberId: member.id },
                        data: { contactName: row.displayName },
                    });
                    changed += r.count;
                }
                if (row.phone !== member.phone) {
                    const r = await tx.listingAgency.updateMany({
                        where: { agencyId, contactMemberId: member.id, contactPhone: member.phone },
                        data: { contactPhone: row.phone },
                    });
                    changed += r.count;
                }
            }
            return { updated: row, relinked: changed };
        });
        await this.cache.invalidatePublic();
        if (relinked > 0)
            await this.listings.invalidateSearch();
        return (0, agency_mapper_1.toMemberView)(updated);
    }
    async remove(user, memberId) {
        const agencyId = await this.managedAgencyId(user.userId);
        const member = await this.findMember(agencyId, memberId);
        if (member.role === shared_1.AgencyMemberRole.OWNER) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AGENCY_OWNER_NOT_REMOVABLE);
        }
        const relinked = await this.prisma.$transaction(async (tx) => {
            await (0, locks_1.lockUserMembership)(tx, member.userId);
            return this.deactivate(tx, agencyId, member.id, member.userId);
        });
        await this.afterDeparture(member.userId, relinked);
    }
    /** The caller's own live membership (owner or agent), or 404. */
    async myMembership(user) {
        const m = await this.prisma.agencyMember.findFirst({
            where: liveMembershipWhere(user.userId),
            orderBy: { joinedAt: 'asc' },
            select: {
                id: true,
                role: true,
                displayName: true,
                agency: {
                    select: { id: true, name: true, phone: true, roadAddress: true, status: true },
                },
            },
        });
        if (!m)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AGENCY_MEMBER_NOT_FOUND);
        return { memberId: m.id, role: m.role, displayName: m.displayName, agency: m.agency };
    }
    /** An AGENT leaves their agency. Owners cannot leave (the agency would be ownerless). */
    async leave(user) {
        const m = await this.prisma.agencyMember.findFirst({
            where: liveMembershipWhere(user.userId),
            select: { id: true, role: true, agencyId: true },
        });
        if (!m)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AGENCY_MEMBER_NOT_FOUND);
        if (m.role === shared_1.AgencyMemberRole.OWNER) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AGENCY_OWNER_NOT_REMOVABLE);
        }
        const relinked = await this.prisma.$transaction(async (tx) => {
            await (0, locks_1.lockUserMembership)(tx, user.userId);
            return this.deactivate(tx, m.agencyId, m.id, user.userId);
        });
        await this.afterDeparture(user.userId, relinked);
    }
    // ---------- invites ----------
    async createInvite(user, input) {
        const agencyId = await this.managedAgencyId(user.userId);
        if ((await this.invites.countForAgency(agencyId)) >= constants_1.MAX_ACTIVE_INVITES) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AGENCY_INVITE_LIMIT, { max: constants_1.MAX_ACTIVE_INVITES });
        }
        const { record, code } = await this.invites.create({
            agencyId,
            createdByUserId: user.userId,
            label: input.label ?? null,
            ttlSeconds: input.expiresInHours * 3600,
        });
        return (0, agency_invite_store_1.toInviteView)(record, code);
    }
    async listInvites(user) {
        const agencyId = await this.managedAgencyId(user.userId);
        return (await this.invites.listForAgency(agencyId)).map((r) => (0, agency_invite_store_1.toInviteView)(r));
    }
    async revokeInvite(user, inviteId) {
        const agencyId = await this.managedAgencyId(user.userId);
        if (!(await this.invites.revoke(agencyId, inviteId))) {
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AGENCY_INVITE_NOT_FOUND);
        }
    }
    /** Redeems an invite code: the user becomes an ACTIVE AGENT of the inviting (APPROVED) agency. */
    async join(user, input) {
        const now = new Date();
        const peeked = await this.invites.peek(input.code);
        if (!peeked)
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AGENCY_INVITE_INVALID);
        // Eligibility and the privacy consent (D8) are checked before the code is claimed so a refused
        // join does not burn it; both are checked again inside the transaction.
        await this.assertCanJoin(this.prisma, user.userId, peeked.agencyId);
        await this.terms.verifyActionConsents(shared_1.ACTION_CONSENT_TERMS.AGENCY_JOIN, input.consents, now);
        const claimed = await this.invites.consume(input.code);
        if (!claimed)
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AGENCY_INVITE_INVALID);
        try {
            await this.prisma.$transaction(async (tx) => {
                await (0, locks_1.lockUserMembership)(tx, user.userId);
                await this.assertCanJoin(tx, user.userId, claimed.agencyId);
                await this.terms.consentForAction(tx, user.userId, shared_1.ACTION_CONSENT_TERMS.AGENCY_JOIN, input.consents, now);
                const data = {
                    role: shared_1.AgencyMemberRole.AGENT,
                    status: shared_1.AgencyMemberStatus.ACTIVE,
                    displayName: input.displayName,
                    title: input.title ?? null,
                    phone: input.phone ?? null,
                    // Always 중개보조원 until the owner confirms the license (PATCH members/:id): a joining
                    // user's own claim never makes them advertisable (공인중개사법 제18조의2①).
                    isLicensed: false,
                    licenseNumber: null,
                };
                await tx.agencyMember.upsert({
                    where: { agencyId_userId: { agencyId: claimed.agencyId, userId: user.userId } },
                    create: { agencyId: claimed.agencyId, userId: user.userId, ...data },
                    update: { ...data, joinedAt: new Date(), removedAt: null },
                });
                await tx.user.update({ where: { id: user.userId }, data: { role: shared_1.UserRole.AGENT } });
            });
        }
        catch (err) {
            await this.invites.restore(claimed);
            throw err;
        }
        await this.sessions.apply(user.userId, { role: shared_1.UserRole.AGENT, agencyId: claimed.agencyId });
        await this.cache.invalidatePublic();
        return this.myMembership({ ...user, role: shared_1.UserRole.AGENT, agencyId: claimed.agencyId });
    }
    // ---------- internals ----------
    /** The APPROVED agency the user owns (staff can be managed only after approval). */
    async managedAgencyId(userId) {
        const agency = await this.prisma.agency.findFirst({
            where: { ownerUserId: userId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            select: { id: true, status: true },
        });
        if (!agency)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AGENCY_NOT_FOUND);
        if (agency.status !== shared_1.AgencyStatus.APPROVED) {
            throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.AGENCY_NOT_APPROVED);
        }
        return agency.id;
    }
    async findMember(agencyId, memberId, db = this.prisma) {
        const member = await db.agencyMember.findFirst({
            where: { id: memberId, agencyId, status: shared_1.AgencyMemberStatus.ACTIVE },
            select: {
                id: true,
                userId: true,
                role: true,
                isLicensed: true,
                licenseNumber: true,
                displayName: true,
                phone: true,
            },
        });
        if (!member)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AGENCY_MEMBER_NOT_FOUND);
        return member;
    }
    async assertCanJoin(db, userId, agencyId) {
        const agency = await db.agency.findFirst({
            where: { id: agencyId, deletedAt: null, status: shared_1.AgencyStatus.APPROVED },
            select: { id: true },
        });
        if (!agency)
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AGENCY_INVITE_INVALID);
        const [owned, member] = await Promise.all([
            db.agency.count({
                where: { ownerUserId: userId, deletedAt: null, status: { in: [...shared_1.LIVE_AGENCY_STATUSES] } },
            }),
            db.agencyMember.count({ where: liveMembershipWhere(userId) }),
        ]);
        if (owned > 0 || member > 0)
            throw app_exception_1.AppException.conflict(shared_1.ErrorCode.AGENCY_ALREADY_MEMBER);
    }
    /** Marks the member REMOVED, downgrades the user and takes them off the agency's listing ads. */
    async deactivate(tx, agencyId, memberId, userId) {
        await tx.agencyMember.update({
            where: { id: memberId },
            data: { status: shared_1.AgencyMemberStatus.REMOVED, removedAt: new Date() },
        });
        await tx.user.updateMany({
            where: { id: userId, role: shared_1.UserRole.AGENT },
            data: { role: shared_1.UserRole.USER },
        });
        return this.listings.memberDeparted(tx, agencyId, memberId);
    }
    async afterDeparture(userId, relinkedListings) {
        await this.sessions.apply(userId, { role: shared_1.UserRole.USER, agencyId: null });
        await this.cache.invalidatePublic();
        if (relinkedListings > 0)
            await this.listings.invalidateSearch();
    }
};
exports.AgencyMembersService = AgencyMembersService;
exports.AgencyMembersService = AgencyMembersService = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, common_1.Inject)(agency_listings_sync_1.AGENCY_LISTINGS_SYNC)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        agency_invite_store_1.AgencyInviteStore,
        agency_cache_service_1.AgencyCacheService,
        agency_session_sync_service_1.AgencySessionSyncService,
        auth_1.TermsService, Object])
], AgencyMembersService);
//# sourceMappingURL=agency-members.service.js.map