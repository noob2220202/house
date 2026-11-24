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
exports.AgencyReviewService = exports.DUPLICATE_REGISTRATION_REJECT_REASON = void 0;
const node_crypto_1 = require("node:crypto");
const promises_1 = require("node:fs/promises");
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../../../common/audit/audit.service");
const ads_invalidation_service_1 = require("../../ads/services/ads-invalidation.service");
const cache_service_1 = require("../../../common/cache/cache.service");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const app_config_service_1 = require("../../../config/app-config.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const agency_mapper_1 = require("../agency.mapper");
const agency_selects_1 = require("../agency.selects");
const broker_registry_client_1 = require("../clients/broker-registry.client");
const constants_1 = require("../constants");
const locks_1 = require("../domain/locks");
const prisma_errors_1 = require("../domain/prisma-errors");
const registry_compare_1 = require("../domain/registry-compare");
const agency_listings_sync_1 = require("../ports/agency-listings.sync");
const agency_media_port_1 = require("../ports/agency-media.port");
const agency_cache_service_1 = require("./agency-cache.service");
const agency_invite_store_1 = require("./agency-invite.store");
const agency_session_sync_service_1 = require("./agency-session-sync.service");
const DECISION_VERB = {
    APPROVED: 'approve',
    REJECTED: 'reject',
    SUSPENDED: 'suspend',
};
/**
 * Suspending a live office (its ads disappear) and lifting a suspension both need ADMIN;
 * approving / rejecting a pending application is OPERATOR work.
 */
function minRoleForTransition(from, to) {
    return from === shared_1.AgencyStatus.SUSPENDED || to === shared_1.AgencyStatus.SUSPENDED
        ? shared_1.AdminRole.ADMIN
        : shared_1.AdminRole.OPERATOR;
}
/** Statuses in which an agency's listings are publicly advertised. */
const isPublic = (s) => s === shared_1.AgencyStatus.APPROVED;
const INLINE_MIME = new Set(shared_1.ALLOWED_DOCUMENT_MIME);
/** statusReason of pending applications rejected because another office got the 등록번호. */
exports.DUPLICATE_REGISTRATION_REJECT_REASON = '동일한 등록번호의 다른 중개사무소 신청이 승인되어 자동 반려되었습니다. 등록번호를 확인해 주세요.';
/** Fields of the full detail view, recorded (names only) in the 개인정보 접속기록. */
const DETAIL_PII_FIELDS = [
    'owner.name',
    'owner.email',
    'owner.phone',
    'members.phone',
    'members.licenseNumber',
];
/** Masks contacts of a detail view (mutation responses, REMOVED staff). */
function maskDetail(d) {
    return {
        ...d,
        owner: {
            ...d.owner,
            name: (0, agency_mapper_1.maskName)(d.owner.name),
            email: (0, shared_1.maskEmail)(d.owner.email),
            phone: d.owner.phone ? (0, shared_1.maskPhone)(d.owner.phone) : null,
        },
        members: d.members.map((m) => ({ ...m, phone: m.phone ? (0, shared_1.maskPhone)(m.phone) : null })),
    };
}
/** Admin review of agencies: queue, detail, decisions with history + audit, private documents. */
let AgencyReviewService = class AgencyReviewService {
    constructor(prisma, mapper, audit, cache, jsonCache, sessions, invites, config, listings, media, registry, ads) {
        this.prisma = prisma;
        this.mapper = mapper;
        this.audit = audit;
        this.cache = cache;
        this.jsonCache = jsonCache;
        this.sessions = sessions;
        this.invites = invites;
        this.config = config;
        this.listings = listings;
        this.media = media;
        this.registry = registry;
        this.ads = ads;
    }
    async list(q) {
        const where = {
            deletedAt: null,
            ...(q.status?.length ? { status: { in: q.status } } : {}),
            ...(q.q
                ? {
                    OR: [
                        { name: { contains: q.q, mode: 'insensitive' } },
                        { representativeName: { contains: q.q, mode: 'insensitive' } },
                        { roadAddress: { contains: q.q, mode: 'insensitive' } },
                        { registrationNumber: { contains: q.q } },
                    ],
                }
                : {}),
        };
        const orderBy = q.sort === shared_1.AdminAgencySort.NEWEST
            ? [{ createdAt: 'desc' }, { id: 'desc' }]
            : q.sort === shared_1.AdminAgencySort.NAME
                ? [{ name: 'asc' }, { id: 'asc' }]
                : [{ createdAt: 'asc' }, { id: 'asc' }];
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.agency.findMany({
            where,
            orderBy,
            ...args,
            select: {
                id: true,
                name: true,
                representativeName: true,
                registrationNumber: true,
                phone: true,
                roadAddress: true,
                status: true,
                warningCount: true,
                createdAt: true,
                approvedAt: true,
                owner: { select: { id: true, name: true, email: true } },
                _count: {
                    select: {
                        documents: true,
                        members: { where: { status: shared_1.AgencyMemberStatus.ACTIVE } },
                    },
                },
            },
        }), () => this.prisma.agency.count({ where }));
        return {
            ...page,
            items: page.items.map((a) => ({
                id: a.id,
                name: a.name,
                representativeName: a.representativeName,
                registrationNumber: a.registrationNumber,
                phone: a.phone,
                roadAddress: a.roadAddress,
                status: a.status,
                owner: { id: a.owner.id, name: (0, agency_mapper_1.maskName)(a.owner.name), email: (0, shared_1.maskEmail)(a.owner.email) },
                documentCount: a._count.documents,
                memberCount: a._count.members,
                warningCount: a.warningCount,
                createdAt: a.createdAt.toISOString(),
                approvedAt: a.approvedAt?.toISOString() ?? null,
            })),
        };
    }
    /**
     * Full agency record with owner and staff contacts unmasked. Viewing it is a 개인정보 접속기록
     * (안전성 확보조치 기준 제8조), so it writes an `agency.pii-view` audit row naming the fields shown,
     * never their values. REMOVED staff are included only on request, with phones masked.
     */
    async detail(agencyId, q) {
        const detail = await this.build(agencyId, q.includeRemoved);
        await this.audit.record({
            action: 'agency.pii-view',
            resourceType: 'Agency',
            resourceId: agencyId,
            after: { fields: [...DETAIL_PII_FIELDS], includeRemoved: q.includeRemoved },
        });
        return detail;
    }
    async build(agencyId, includeRemoved = false) {
        const row = await this.prisma.agency.findFirst({
            where: { id: agencyId, deletedAt: null },
            select: {
                ...agency_selects_1.myAgencySelect,
                warningCount: true,
                owner: {
                    select: { id: true, name: true, nickname: true, email: true, phone: true, status: true },
                },
                members: {
                    ...(includeRemoved ? {} : { where: { status: { not: shared_1.AgencyMemberStatus.REMOVED } } }),
                    select: agency_selects_1.agencyMemberSelect,
                    orderBy: [{ status: 'asc' }, { role: 'asc' }, { joinedAt: 'asc' }],
                    take: 100,
                },
                warnings: {
                    select: { id: true, reason: true, reportId: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AGENCY_NOT_FOUND);
        return {
            ...this.mapper.mine(row),
            owner: row.owner,
            members: row.members.map((m) => {
                const view = (0, agency_mapper_1.toMemberView)(m);
                return m.status === shared_1.AgencyMemberStatus.REMOVED
                    ? { ...view, phone: view.phone ? (0, shared_1.maskPhone)(view.phone) : null }
                    : view;
            }),
            warningCount: row.warningCount,
            recentWarnings: row.warnings.map((w) => ({
                id: w.id,
                reason: w.reason,
                reportId: w.reportId,
                createdAt: w.createdAt.toISOString(),
            })),
        };
    }
    /** Mutation responses carry the masked detail; the full view is GET /admin/agencies/:id. */
    async maskedDetail(agencyId) {
        return maskDetail(await this.build(agencyId));
    }
    /** 승인 / 반려 / 정지 / 정지 해제, with status history, notification and audit in one transaction. */
    async decide(agencyId, input, admin) {
        // Every decision needs at least OPERATOR; the transition-specific check runs on `before`.
        if (shared_1.ADMIN_ROLE_RANK[admin.role] < shared_1.ADMIN_ROLE_RANK[shared_1.AdminRole.OPERATOR]) {
            throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.AGENCY_DECISION_FORBIDDEN);
        }
        const to = input.status;
        const reason = input.reason ?? null;
        const outcome = await this.prisma
            .$transaction(async (tx) => {
            await (0, locks_1.lockAgency)(tx, agencyId);
            const before = await tx.agency.findFirst({
                where: { id: agencyId, deletedAt: null },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    statusReason: true,
                    ownerUserId: true,
                    approvedAt: true,
                    suspendedAt: true,
                    registrationKey: true,
                },
            });
            if (!before)
                throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AGENCY_NOT_FOUND);
            const required = minRoleForTransition(before.status, to);
            if (shared_1.ADMIN_ROLE_RANK[admin.role] < shared_1.ADMIN_ROLE_RANK[required]) {
                throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.AGENCY_DECISION_FORBIDDEN);
            }
            if (!(0, shared_1.canAdminTransitionAgency)(before.status, to)) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AGENCY_INVALID_STATUS_TRANSITION, {
                    from: before.status,
                    to,
                });
            }
            const now = new Date();
            const firstApproval = to === shared_1.AgencyStatus.APPROVED && before.status === shared_1.AgencyStatus.PENDING;
            // Going live takes the 등록번호: refuse if another live office holds it (pending ones lose).
            const goesLive = to === shared_1.AgencyStatus.APPROVED && before.status !== shared_1.AgencyStatus.SUSPENDED;
            const key = goesLive ? before.registrationKey : null;
            if (key) {
                await (0, locks_1.lockRegistrationKey)(tx, key);
                const holder = await tx.agency.findFirst({
                    where: {
                        registrationKey: key,
                        deletedAt: null,
                        status: { in: [...shared_1.REGISTRATION_HOLDING_STATUSES] },
                        id: { not: agencyId },
                    },
                    select: { id: true },
                });
                if (holder) {
                    throw app_exception_1.AppException.conflict(shared_1.ErrorCode.AGENCY_REGISTRATION_DUPLICATE, {
                        agencyId: holder.id,
                    });
                }
            }
            const updated = await tx.agency.updateMany({
                where: { id: agencyId, status: before.status },
                data: {
                    status: to,
                    statusReason: reason,
                    ...(firstApproval && !before.approvedAt ? { approvedAt: now } : {}),
                    ...(to === shared_1.AgencyStatus.APPROVED ? { suspendedAt: null } : {}),
                    ...(to === shared_1.AgencyStatus.SUSPENDED ? { suspendedAt: now } : {}),
                },
            });
            if (updated.count !== 1)
                throw app_exception_1.AppException.conflict(shared_1.ErrorCode.AGENCY_STATUS_CONFLICT);
            const visibilityChanged = isPublic(before.status) !== isPublic(to);
            // Suspension takes the office's listings off public search (primary must be APPROVED).
            if (visibilityChanged)
                await this.listings.agencyVisibilityChanged(tx, agencyId);
            await tx.agencyStatusHistory.create({
                data: {
                    agencyId,
                    fromStatus: before.status,
                    toStatus: to,
                    reason,
                    decidedByAdminId: admin.adminId,
                },
            });
            if (firstApproval) {
                await tx.user.update({
                    where: { id: before.ownerUserId },
                    data: { role: shared_1.UserRole.AGENCY_OWNER },
                });
            }
            await tx.notification.create({
                data: { userId: before.ownerUserId, ...this.notificationFor(before, to, reason) },
            });
            await this.audit.record({
                action: `agency.${before.status === shared_1.AgencyStatus.SUSPENDED ? 'reinstate' : DECISION_VERB[to]}`,
                resourceType: 'Agency',
                resourceId: agencyId,
                before: { status: before.status, statusReason: before.statusReason },
                after: { status: to, statusReason: reason },
            }, tx);
            const rejectedOwners = key ? await this.rejectCompetitors(tx, agencyId, key, admin) : [];
            return { before, firstApproval, visibilityChanged, rejectedOwners };
        })
            .catch((err) => {
            // Backstop for the partial unique index agencies_registration_key_live.
            if ((0, prisma_errors_1.isUniqueViolation)(err, 'registrationKey')) {
                throw app_exception_1.AppException.conflict(shared_1.ErrorCode.AGENCY_REGISTRATION_DUPLICATE);
            }
            throw err;
        });
        const ownerId = outcome.before.ownerUserId;
        if (outcome.firstApproval) {
            await this.sessions.apply(ownerId, { role: shared_1.UserRole.AGENCY_OWNER, agencyId });
        }
        else if (to === shared_1.AgencyStatus.REJECTED) {
            await this.sessions.apply(ownerId, { agencyId: null });
        }
        else if (to === shared_1.AgencyStatus.SUSPENDED) {
            await this.invites.revokeAll(agencyId);
        }
        for (const owner of outcome.rejectedOwners) {
            await this.sessions.apply(owner, { agencyId: null });
        }
        await this.cache.invalidatePublic();
        if (outcome.visibilityChanged) {
            await this.listings.invalidateSearch();
            await this.ads.agencyStatusChanged();
        }
        return this.maskedDetail(agencyId);
    }
    /**
     * Rejects the other PENDING applications for a 등록번호 that just went live (one office, one
     * number), with history, notification and audit. Conditional on PENDING, so a concurrent owner
     * edit or admin decision on a competitor simply wins or loses its row lock; no agency lock is
     * taken here (lock order). Returns the owners whose sessions must drop the application.
     */
    async rejectCompetitors(tx, approvedId, registrationKey, admin) {
        const reason = exports.DUPLICATE_REGISTRATION_REJECT_REASON;
        const rows = await tx.$queryRaw `
      UPDATE agencies
      SET status = 'REJECTED'::agency_status, status_reason = ${reason}, updated_at = now()
      WHERE registration_key = ${registrationKey}
        AND deleted_at IS NULL
        AND status = 'PENDING'::agency_status
        AND id <> ${approvedId}::uuid
      RETURNING id, name, owner_user_id`;
        if (rows.length === 0)
            return [];
        await tx.agencyStatusHistory.createMany({
            data: rows.map((r) => ({
                agencyId: r.id,
                fromStatus: shared_1.AgencyStatus.PENDING,
                toStatus: shared_1.AgencyStatus.REJECTED,
                reason,
                decidedByAdminId: admin.adminId,
            })),
        });
        await tx.notification.createMany({
            data: rows.map((r) => ({
                userId: r.owner_user_id,
                ...this.notificationFor({ id: r.id, name: r.name, status: shared_1.AgencyStatus.PENDING }, shared_1.AgencyStatus.REJECTED, reason),
            })),
        });
        for (const r of rows) {
            await this.audit.record({
                action: 'agency.reject',
                resourceType: 'Agency',
                resourceId: r.id,
                before: { status: shared_1.AgencyStatus.PENDING },
                after: {
                    status: shared_1.AgencyStatus.REJECTED,
                    statusReason: reason,
                    duplicateOfAgencyId: approvedId,
                },
            }, tx);
        }
        return rows.map((r) => r.owner_user_id);
    }
    /**
     * Soft-deletes an application that never went live (PENDING / REJECTED), e.g. a fake one, so
     * nothing of it lingers in the queue or the applicant's account. A pending one is rejected
     * first (history row). Staff rows are closed, the applicant is notified, the action audited.
     * Documents are kept as evidence (not released to media cleanup).
     */
    async remove(agencyId, input, admin) {
        const before = await this.prisma.$transaction(async (tx) => {
            await (0, locks_1.lockAgency)(tx, agencyId);
            const row = await tx.agency.findFirst({
                where: { id: agencyId, deletedAt: null },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    statusReason: true,
                    ownerUserId: true,
                    registrationNumber: true,
                },
            });
            if (!row)
                throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AGENCY_NOT_FOUND);
            if (!shared_1.ADMIN_DELETABLE_AGENCY_STATUSES.includes(row.status)) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AGENCY_NOT_DELETABLE, { status: row.status });
            }
            const now = new Date();
            const updated = await tx.agency.updateMany({
                where: { id: agencyId, status: row.status, deletedAt: null },
                data: { status: shared_1.AgencyStatus.REJECTED, statusReason: input.reason, deletedAt: now },
            });
            if (updated.count !== 1)
                throw app_exception_1.AppException.conflict(shared_1.ErrorCode.AGENCY_STATUS_CONFLICT);
            if (row.status === shared_1.AgencyStatus.PENDING) {
                await tx.agencyStatusHistory.create({
                    data: {
                        agencyId,
                        fromStatus: shared_1.AgencyStatus.PENDING,
                        toStatus: shared_1.AgencyStatus.REJECTED,
                        reason: input.reason,
                        decidedByAdminId: admin.adminId,
                    },
                });
            }
            await tx.agencyMember.updateMany({
                where: { agencyId, status: { not: shared_1.AgencyMemberStatus.REMOVED } },
                data: { status: shared_1.AgencyMemberStatus.REMOVED, removedAt: now },
            });
            await tx.notification.create({
                data: {
                    userId: row.ownerUserId,
                    type: shared_1.NotificationType.AGENCY_REJECTED,
                    title: '중개사무소 등록 신청이 삭제되었습니다.',
                    body: input.reason,
                    data: { agencyId },
                },
            });
            await this.audit.record({
                action: 'agency.delete',
                resourceType: 'Agency',
                resourceId: agencyId,
                before: {
                    status: row.status,
                    statusReason: row.statusReason,
                    registrationNumber: row.registrationNumber,
                    deletedAt: null,
                },
                after: {
                    status: shared_1.AgencyStatus.REJECTED,
                    statusReason: input.reason,
                    deletedAt: now.toISOString(),
                },
            }, tx);
            return row;
        });
        // A pending owner acted for the application (a rejected one was already detached).
        if (before.status === shared_1.AgencyStatus.PENDING) {
            await this.sessions.apply(before.ownerUserId, { agencyId: null });
        }
    }
    /**
     * 소재지 변경 of an approved / suspended office after the admin checked its 이전신고 (the owner
     * cannot edit these fields once approved). Audited with before/after; the owner is notified.
     */
    async updateLocation(agencyId, input) {
        const { reason, ...fields } = input;
        await this.prisma.$transaction(async (tx) => {
            await (0, locks_1.lockAgency)(tx, agencyId);
            const before = await tx.agency.findFirst({
                where: { id: agencyId, deletedAt: null },
                select: {
                    id: true,
                    name: true,
                    ownerUserId: true,
                    status: true,
                    roadAddress: true,
                    jibunAddress: true,
                    addressDetail: true,
                    zipCode: true,
                    emdCode: true,
                    sggCode: true,
                    lat: true,
                    lng: true,
                },
            });
            if (!before)
                throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AGENCY_NOT_FOUND);
            // Pending / rejected applications are corrected by the owner (PATCH mine / resubmit).
            if (before.status !== shared_1.AgencyStatus.APPROVED && before.status !== shared_1.AgencyStatus.SUSPENDED) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.AGENCY_NOT_EDITABLE);
            }
            const sggCode = fields.emdCode !== undefined
                ? fields.emdCode
                    ? (0, shared_1.sggCodeOf)(fields.emdCode)
                    : this.config.get('REGION_SGG_CODE')
                : before.sggCode;
            await tx.agency.update({
                where: { id: agencyId },
                data: {
                    roadAddress: fields.roadAddress,
                    jibunAddress: fields.jibunAddress,
                    addressDetail: fields.addressDetail,
                    zipCode: fields.zipCode,
                    emdCode: fields.emdCode,
                    lat: fields.lat,
                    lng: fields.lng,
                    sggCode,
                },
            });
            const { id: _id, name, ownerUserId, status: _status, ...location } = before;
            await this.audit.record({
                action: 'agency.location.update',
                resourceType: 'Agency',
                resourceId: agencyId,
                before: location,
                after: { ...location, ...fields, sggCode, reason },
            }, tx);
            await tx.notification.create({
                data: {
                    userId: ownerUserId,
                    type: shared_1.NotificationType.SYSTEM,
                    title: `${name} 중개사무소 소재지 정보가 변경되었습니다.`,
                    body: fields.roadAddress ?? null,
                    data: { agencyId },
                },
            });
        });
        await this.cache.invalidatePublic();
        return this.maskedDetail(agencyId);
    }
    /** Resolves a private document file for the authorized admin download. */
    async documentFile(agencyId, docId) {
        const doc = await this.prisma.agencyDocument.findFirst({
            where: { id: docId, agencyId, agency: { deletedAt: null } },
            select: {
                id: true,
                type: true,
                media: { select: { storageKey: true, mimeType: true, deletedAt: true } },
            },
        });
        if (!doc || doc.media.deletedAt)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AGENCY_DOCUMENT_NOT_FOUND);
        const filePath = this.media.privateFilePath(doc.media.storageKey);
        const info = filePath ? await (0, promises_1.stat)(filePath).catch(() => null) : null;
        if (!filePath || !info?.isFile()) {
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AGENCY_DOCUMENT_NOT_FOUND);
        }
        this.audit.recordSafe({
            action: 'agency.document.view',
            resourceType: 'AgencyDocument',
            resourceId: doc.id,
            after: { agencyId, type: doc.type },
        });
        const ext = doc.media.mimeType === 'application/pdf' ? 'pdf' : doc.media.mimeType.split('/')[1];
        return {
            path: filePath,
            mimeType: doc.media.mimeType,
            sizeBytes: info.size,
            filename: `agency-${agencyId.slice(0, 8)}-${doc.type.toLowerCase()}.${ext ?? 'bin'}`,
            inline: INLINE_MIME.has(doc.media.mimeType),
        };
    }
    /** Compares the application with the public broker registry (cached a day; `refresh` bypasses). */
    async registryCheck(agencyId, refresh) {
        const agency = await this.prisma.agency.findFirst({
            where: { id: agencyId, deletedAt: null },
            select: { name: true, representativeName: true, registrationNumber: true, sggCode: true },
        });
        if (!agency)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.AGENCY_NOT_FOUND);
        const fingerprint = (0, node_crypto_1.createHash)('sha1')
            .update([agency.registrationNumber, agency.name, agency.representativeName].join('|'))
            .digest('hex')
            .slice(0, 12);
        const key = `${constants_1.AGENCY_REDIS.registryCheck(agencyId)}:${fingerprint}`;
        if (!refresh) {
            const hit = await this.jsonCache.get(key);
            if (hit)
                return hit;
        }
        const unavailable = () => ({
            status: shared_1.RegistryCheckStatus.UNAVAILABLE,
            checkedAt: new Date().toISOString(),
            record: null,
            mismatches: [],
        });
        if (!this.registry.enabled)
            return unavailable();
        try {
            const record = await this.registry.findByRegistrationNumber(agency.registrationNumber, agency.sggCode);
            const result = {
                ...(0, registry_compare_1.compareWithRegistry)(agency, record),
                checkedAt: new Date().toISOString(),
                record,
            };
            await this.jsonCache.set(key, result, constants_1.REGISTRY_CACHE_TTL_SECONDS);
            return result;
        }
        catch (err) {
            if (err instanceof broker_registry_client_1.BrokerRegistryUnavailableError)
                return unavailable();
            throw err;
        }
    }
    notificationFor(agency, to, reason) {
        const data = { agencyId: agency.id };
        if (to === shared_1.AgencyStatus.APPROVED && agency.status === shared_1.AgencyStatus.PENDING) {
            return {
                type: shared_1.NotificationType.AGENCY_APPROVED,
                title: `${agency.name} 중개사무소 등록이 승인되었습니다.`,
                body: null,
                data,
            };
        }
        if (to === shared_1.AgencyStatus.APPROVED) {
            return {
                type: shared_1.NotificationType.SYSTEM,
                title: '중개사무소 이용 정지가 해제되었습니다.',
                body: null,
                data,
            };
        }
        if (to === shared_1.AgencyStatus.REJECTED) {
            return {
                type: shared_1.NotificationType.AGENCY_REJECTED,
                title: '중개사무소 등록 신청이 반려되었습니다.',
                body: reason,
                data,
            };
        }
        return {
            type: shared_1.NotificationType.SYSTEM,
            title: '중개사무소 이용이 정지되었습니다.',
            body: reason,
            data,
        };
    }
};
exports.AgencyReviewService = AgencyReviewService;
exports.AgencyReviewService = AgencyReviewService = __decorate([
    (0, common_1.Injectable)(),
    __param(8, (0, common_1.Inject)(agency_listings_sync_1.AGENCY_LISTINGS_SYNC)),
    __param(9, (0, common_1.Inject)(agency_media_port_1.AGENCY_MEDIA)),
    __param(10, (0, common_1.Inject)(broker_registry_client_1.BROKER_REGISTRY)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        agency_mapper_1.AgencyMapper,
        audit_service_1.AuditService,
        agency_cache_service_1.AgencyCacheService,
        cache_service_1.CacheService,
        agency_session_sync_service_1.AgencySessionSyncService,
        agency_invite_store_1.AgencyInviteStore,
        app_config_service_1.AppConfig, Object, Object, Object, ads_invalidation_service_1.AdsInvalidationService])
], AgencyReviewService);
//# sourceMappingURL=agency-review.service.js.map