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
exports.AgencyRegistrationService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_service_1 = require("../../../common/audit/audit.service");
const app_exception_1 = require("../../../common/errors/app.exception");
const app_config_service_1 = require("../../../config/app-config.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const auth_1 = require("../../auth");
const agency_mapper_1 = require("../agency.mapper");
const agency_selects_1 = require("../agency.selects");
const constants_1 = require("../constants");
const locks_1 = require("../domain/locks");
const agency_media_port_1 = require("../ports/agency-media.port");
const agency_cache_service_1 = require("./agency-cache.service");
const agency_session_sync_service_1 = require("./agency-session-sync.service");
/** Profile statuses in which the owner may edit the public profile. */
const EDITABLE_STATUSES = [shared_1.AgencyStatus.PENDING, shared_1.AgencyStatus.APPROVED];
/**
 * 소재지 fields are printed on the 등록증 and disclosed with every ad (제18조의2). Once approved
 * they change only through admin review (이전신고 확인 → PATCH /admin/agencies/:id/location).
 */
const REVIEWED_LOCATION_FIELDS = [
    'roadAddress',
    'jibunAddress',
    'addressDetail',
    'zipCode',
    'emdCode',
    'lat',
    'lng',
];
/** Documents can be removed only before approval (an approved agency keeps its evidence). */
const DOCUMENT_REMOVABLE_STATUSES = [shared_1.AgencyStatus.PENDING, shared_1.AgencyStatus.REJECTED];
/**
 * 중개사무소 등록 신청 (→ PENDING), 반려 후 재신청, the owner's own profile and private documents.
 * "Mine" is the agency the user owns (any status): pending applicants are still role USER.
 */
let AgencyRegistrationService = class AgencyRegistrationService {
    constructor(prisma, config, mapper, cache, sessions, audit, terms, media) {
        this.prisma = prisma;
        this.config = config;
        this.mapper = mapper;
        this.cache = cache;
        this.sessions = sessions;
        this.audit = audit;
        this.terms = terms;
        this.media = media;
    }
    async register(user, input) {
        const now = new Date();
        // Pending rows are outside the partial unique index, so no unique violation can occur here.
        const agencyId = await this.prisma.$transaction(async (tx) => {
            await (0, locks_1.lockUserMembership)(tx, user.userId);
            await this.assertCanStartAgency(tx, user.userId);
            // 개인정보 수집·이용 동의 (D8): current version, recorded with the application.
            await this.terms.consentForAction(tx, user.userId, shared_1.ACTION_CONSENT_TERMS.AGENCY_APPLICATION, input.consents, now);
            await this.assertRegistrationNumberFree(tx, input.registrationNumber);
            await this.media.assertDocumentsUsable(input.documents.map((d) => d.mediaId), user.userId, tx);
            const agency = await tx.agency.create({
                data: {
                    ownerUserId: user.userId,
                    name: input.name,
                    representativeName: input.representativeName,
                    registrationNumber: input.registrationNumber,
                    businessNumber: input.businessNumber,
                    ...this.profileData(input),
                    phone: input.phone,
                    roadAddress: input.roadAddress,
                    lat: input.lat,
                    lng: input.lng,
                    sggCode: this.sggCodeFor(input.emdCode),
                    specialties: input.specialties ?? [],
                    status: shared_1.AgencyStatus.PENDING,
                },
                select: { id: true },
            });
            await tx.agencyMember.create({
                data: {
                    agencyId: agency.id,
                    userId: user.userId,
                    role: shared_1.AgencyMemberRole.OWNER,
                    status: shared_1.AgencyMemberStatus.ACTIVE,
                    displayName: input.representativeName,
                    phone: input.mobile ?? null,
                    isLicensed: true,
                },
            });
            await this.createDocuments(tx, agency.id, user.userId, input.documents);
            await tx.agencyStatusHistory.create({
                data: { agencyId: agency.id, fromStatus: null, toStatus: shared_1.AgencyStatus.PENDING },
            });
            return agency.id;
        });
        // Pending owners act for their application (as UserSessionService computes on next login).
        await this.sessions.apply(user.userId, { agencyId });
        return this.loadMine(agencyId);
    }
    /**
     * GET /agencies/mine: the owner's agency (any status) with `myRole: OWNER`, or — for staff (B2) —
     * a reduced view of the agency they work for with `myRole: AGENT`: same shape, but no documents,
     * status history or 사업자등록번호 (owner-only data). A rejected applicant who has since joined
     * another office gets that office. 404 when the user neither owns nor works for an agency.
     */
    async getMine(user) {
        const owned = await this.findOwned(user.userId);
        if (owned && owned.status !== shared_1.AgencyStatus.REJECTED) {
            return { ...(await this.loadMine(owned.id)), myRole: shared_1.AgencyMemberRole.OWNER };
        }
        const staff = await this.prisma.agencyMember.findFirst({
            where: {
                userId: user.userId,
                role: shared_1.AgencyMemberRole.AGENT,
                status: shared_1.AgencyMemberStatus.ACTIVE,
                agency: { deletedAt: null, status: { in: [...shared_1.LIVE_AGENCY_STATUSES] } },
            },
            orderBy: { joinedAt: 'asc' },
            select: { agencyId: true },
        });
        if (staff) {
            const agency = await this.loadMine(staff.agencyId);
            return {
                ...agency,
                businessNumber: null,
                documents: [],
                statusHistory: [],
                myRole: shared_1.AgencyMemberRole.AGENT,
            };
        }
        if (owned)
            return { ...(await this.loadMine(owned.id)), myRole: shared_1.AgencyMemberRole.OWNER };
        throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AGENCY_NOT_FOUND);
    }
    async updateMine(user, input) {
        const owned = await this.ownedAgency(user.userId);
        const { logoMediaId, coverMediaId, ...profile } = input;
        await this.prisma.$transaction(async (tx) => {
            await (0, locks_1.lockAgency)(tx, owned.id);
            const before = await tx.agency.findUniqueOrThrow({
                where: { id: owned.id },
                select: {
                    status: true,
                    phone: true,
                    mobile: true,
                    email: true,
                    logoMediaId: true,
                    coverMediaId: true,
                },
            });
            if (!EDITABLE_STATUSES.includes(before.status)) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AGENCY_NOT_EDITABLE);
            }
            if (logoMediaId)
                await this.media.assertLogoUsable(logoMediaId, user.userId, tx);
            if (coverMediaId)
                await this.media.assertCoverUsable(coverMediaId, user.userId, tx);
            if (before.status === shared_1.AgencyStatus.APPROVED) {
                const fields = REVIEWED_LOCATION_FIELDS.filter((f) => profile[f] !== undefined);
                if (fields.length > 0) {
                    throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AGENCY_NOT_EDITABLE, {
                        fields,
                        reason: 'LOCATION_REQUIRES_REVIEW',
                    });
                }
            }
            await tx.agency.update({
                where: { id: owned.id },
                data: {
                    ...this.profileData(profile),
                    ...(profile.emdCode !== undefined ? { sggCode: this.sggCodeFor(profile.emdCode) } : {}),
                    ...(logoMediaId !== undefined ? { logoMediaId } : {}),
                    ...(coverMediaId !== undefined ? { coverMediaId } : {}),
                },
            });
            // Replaced / removed images go back to the orphan grace period (then the cleanup job).
            const released = [
                logoMediaId !== undefined && before.logoMediaId !== logoMediaId ? before.logoMediaId : null,
                coverMediaId !== undefined && before.coverMediaId !== coverMediaId
                    ? before.coverMediaId
                    : null,
            ].filter((id) => !!id);
            if (released.length > 0)
                await this.media.released(released, tx);
            // 연락처 of a live office is part of every ad's disclosure: keep a trail of who changed it.
            if (before.status === shared_1.AgencyStatus.APPROVED) {
                const changed = ['phone', 'mobile', 'email'].filter((f) => profile[f] !== undefined && profile[f] !== before[f]);
                if (changed.length > 0) {
                    // Office contact data is public; keys avoid the audit PII redaction of "phone".
                    const contact = (v) => Object.fromEntries(changed.map((f) => [`office_${f}`, v[f] ?? null]));
                    await this.audit.record({
                        action: 'agency.contact.update',
                        resourceType: 'Agency',
                        resourceId: owned.id,
                        before: contact(before),
                        after: contact(profile),
                    }, tx);
                }
            }
        });
        await this.cache.invalidatePublic();
        return this.loadMine(owned.id);
    }
    /** 반려된 신청 보완 후 재신청: REJECTED → PENDING with a history row. */
    async resubmit(user, input) {
        const owned = await this.ownedAgency(user.userId);
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            // Same lock order as join(): membership first, then the agency.
            await (0, locks_1.lockUserMembership)(tx, user.userId);
            await (0, locks_1.lockAgency)(tx, owned.id);
            const current = await tx.agency.findUniqueOrThrow({
                where: { id: owned.id },
                select: { status: true },
            });
            if (current.status !== shared_1.AgencyStatus.REJECTED) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AGENCY_INVALID_STATUS_TRANSITION, {
                    from: current.status,
                    to: shared_1.AgencyStatus.PENDING,
                });
            }
            // Back to PENDING makes the owner act for this agency again: refuse while they are an
            // active member of another live agency (e.g. joined elsewhere after the rejection).
            const elsewhere = await tx.agencyMember.count({
                where: {
                    userId: user.userId,
                    status: shared_1.AgencyMemberStatus.ACTIVE,
                    agencyId: { not: owned.id },
                    agency: { deletedAt: null, status: { in: [...shared_1.LIVE_AGENCY_STATUSES] } },
                },
            });
            if (elsewhere > 0)
                throw app_exception_1.AppException.conflict(shared_1.ErrorCode.AGENCY_ALREADY_MEMBER);
            // D8: a resubmission that shows the consent again records it (current version required).
            if (input.consents?.length) {
                await this.terms.consentForAction(tx, user.userId, shared_1.ACTION_CONSENT_TERMS.AGENCY_APPLICATION, input.consents, now);
            }
            if (input.registrationNumber) {
                await this.assertRegistrationNumberFree(tx, input.registrationNumber, owned.id);
            }
            if (input.documents?.length) {
                await this.assertDocumentRoom(tx, owned.id, input.documents.length);
                await this.media.assertDocumentsUsable(input.documents.map((d) => d.mediaId), user.userId, tx);
                await this.createDocuments(tx, owned.id, user.userId, input.documents);
            }
            const { name, representativeName, registrationNumber, businessNumber } = input;
            await tx.agency.update({
                where: { id: owned.id },
                data: {
                    ...(name !== undefined ? { name } : {}),
                    ...(representativeName !== undefined ? { representativeName } : {}),
                    ...(registrationNumber !== undefined ? { registrationNumber } : {}),
                    ...(businessNumber !== undefined ? { businessNumber } : {}),
                    ...this.profileData(input),
                    ...(input.emdCode !== undefined ? { sggCode: this.sggCodeFor(input.emdCode) } : {}),
                    status: shared_1.AgencyStatus.PENDING,
                    statusReason: null,
                },
            });
            await tx.agencyStatusHistory.create({
                data: {
                    agencyId: owned.id,
                    fromStatus: shared_1.AgencyStatus.REJECTED,
                    toStatus: shared_1.AgencyStatus.PENDING,
                    reason: input.message ?? null,
                },
            });
        });
        await this.sessions.apply(user.userId, { agencyId: owned.id });
        return this.loadMine(owned.id);
    }
    async listDocuments(user) {
        const { id } = await this.ownedAgency(user.userId);
        const docs = await this.prisma.agencyDocument.findMany({
            where: { agencyId: id },
            select: agency_selects_1.agencyDocumentSelect,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        return docs.map(agency_mapper_1.toDocumentView);
    }
    async addDocument(user, input) {
        const owned = await this.ownedAgency(user.userId);
        const doc = await this.prisma.$transaction(async (tx) => {
            await (0, locks_1.lockAgency)(tx, owned.id);
            await this.assertDocumentRoom(tx, owned.id, 1);
            await this.media.assertDocumentsUsable([input.mediaId], user.userId, tx);
            return tx.agencyDocument.create({
                data: {
                    agencyId: owned.id,
                    type: input.type,
                    mediaId: input.mediaId,
                    uploadedById: user.userId,
                },
                select: agency_selects_1.agencyDocumentSelect,
            });
        });
        return (0, agency_mapper_1.toDocumentView)(doc);
    }
    async removeDocument(user, docId) {
        const owned = await this.ownedAgency(user.userId);
        await this.prisma.$transaction(async (tx) => {
            await (0, locks_1.lockAgency)(tx, owned.id);
            const doc = await tx.agencyDocument.findFirst({
                where: { id: docId, agencyId: owned.id },
                select: { id: true, type: true, mediaId: true },
            });
            if (!doc)
                throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AGENCY_DOCUMENT_NOT_FOUND);
            const { status } = await tx.agency.findUniqueOrThrow({
                where: { id: owned.id },
                select: { status: true },
            });
            if (!DOCUMENT_REMOVABLE_STATUSES.includes(status)) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AGENCY_NOT_EDITABLE);
            }
            if (doc.type === shared_1.AgencyDocumentType.REGISTRATION_CERT) {
                const certs = await tx.agencyDocument.count({
                    where: { agencyId: owned.id, type: shared_1.AgencyDocumentType.REGISTRATION_CERT },
                });
                if (certs <= 1)
                    throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AGENCY_DOCUMENT_REQUIRED);
            }
            await tx.agencyDocument.delete({ where: { id: doc.id } });
            await this.media.released([doc.mediaId], tx);
        });
    }
    // ---------- internals ----------
    /** The user's own (not deleted) agency; 404 when they have none. */
    async ownedAgency(userId) {
        const agency = await this.findOwned(userId);
        if (!agency)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AGENCY_NOT_FOUND);
        return agency;
    }
    findOwned(userId) {
        return this.prisma.agency.findFirst({
            where: { ownerUserId: userId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            select: { id: true, status: true },
        });
    }
    async loadMine(agencyId) {
        const row = await this.prisma.agency.findUniqueOrThrow({
            where: { id: agencyId },
            select: agency_selects_1.myAgencySelect,
        });
        return this.mapper.mine(row);
    }
    /** One application per user, and not while acting for another live agency. */
    async assertCanStartAgency(tx, userId) {
        const owned = await tx.agency.findFirst({
            where: { ownerUserId: userId, deletedAt: null },
            select: { id: true, status: true },
        });
        if (owned) {
            throw app_exception_1.AppException.conflict(shared_1.ErrorCode.AGENCY_ALREADY_REGISTERED, {
                agencyId: owned.id,
                status: owned.status,
            });
        }
        const member = await tx.agencyMember.count({
            where: {
                userId,
                status: shared_1.AgencyMemberStatus.ACTIVE,
                agency: { deletedAt: null, status: { in: [...shared_1.LIVE_AGENCY_STATUSES] } },
            },
        });
        if (member > 0)
            throw app_exception_1.AppException.conflict(shared_1.ErrorCode.AGENCY_ALREADY_MEMBER);
    }
    /**
     * 등록번호 is taken only by a live office (APPROVED / SUSPENDED, not deleted), compared on the
     * punctuation/case-insensitive key; the partial unique index agencies_registration_key_live
     * backs it. Pending or rejected applications never reserve a number (a stranger could otherwise
     * park a real office's public 등록번호 and lock it out); approval settles competing ones.
     */
    async assertRegistrationNumberFree(tx, registrationNumber, exceptAgencyId) {
        const taken = await tx.agency.findFirst({
            where: {
                registrationKey: (0, shared_1.registrationNumberKey)(registrationNumber),
                deletedAt: null,
                status: { in: [...shared_1.REGISTRATION_HOLDING_STATUSES] },
                ...(exceptAgencyId ? { id: { not: exceptAgencyId } } : {}),
            },
            select: { id: true },
        });
        if (taken)
            throw app_exception_1.AppException.conflict(shared_1.ErrorCode.AGENCY_REGISTRATION_DUPLICATE);
    }
    async assertDocumentRoom(tx, agencyId, adding) {
        const count = await tx.agencyDocument.count({ where: { agencyId } });
        if (count + adding > constants_1.MAX_AGENCY_DOCUMENTS) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AGENCY_DOCUMENT_LIMIT, { max: constants_1.MAX_AGENCY_DOCUMENTS });
        }
    }
    async createDocuments(tx, agencyId, userId, docs) {
        await tx.agencyDocument.createMany({
            data: docs.map((d) => ({ agencyId, type: d.type, mediaId: d.mediaId, uploadedById: userId })),
        });
    }
    sggCodeFor(emdCode) {
        return emdCode ? (0, shared_1.sggCodeOf)(emdCode) : this.config.get('REGION_SGG_CODE');
    }
    /** Optional profile fields → Prisma data; `undefined` leaves a column untouched. */
    profileData(p) {
        return {
            phone: p.phone,
            mobile: p.mobile,
            email: p.email,
            roadAddress: p.roadAddress,
            jibunAddress: p.jibunAddress,
            addressDetail: p.addressDetail,
            zipCode: p.zipCode,
            emdCode: p.emdCode,
            lat: p.lat,
            lng: p.lng,
            intro: p.intro,
            businessHours: p.businessHours === null ? client_1.Prisma.DbNull : p.businessHours,
            specialties: p.specialties,
        };
    }
};
exports.AgencyRegistrationService = AgencyRegistrationService;
exports.AgencyRegistrationService = AgencyRegistrationService = __decorate([
    (0, common_1.Injectable)(),
    __param(7, (0, common_1.Inject)(agency_media_port_1.AGENCY_MEDIA)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        app_config_service_1.AppConfig,
        agency_mapper_1.AgencyMapper,
        agency_cache_service_1.AgencyCacheService,
        agency_session_sync_service_1.AgencySessionSyncService,
        audit_service_1.AuditService,
        auth_1.TermsService, Object])
], AgencyRegistrationService);
//# sourceMappingURL=agency-registration.service.js.map