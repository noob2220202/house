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
var DealRequestsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealRequestsService = void 0;
const shared_1 = require("@house/shared");
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const daily_cap_service_1 = require("../../../common/throttle/daily-cap.service");
const app_config_service_1 = require("../../../config/app-config.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const auth_1 = require("../../auth");
const agencies_service_1 = require("../../agencies/services/agencies.service");
const constants_1 = require("../constants");
const deal_request_mapper_1 = require("../deal-request.mapper");
const deal_request_selects_1 = require("../deal-request.selects");
const notifications_service_1 = require("../notifications/notifications.service");
const agency_directory_port_1 = require("../ports/agency-directory.port");
const complexes_port_1 = require("../ports/complexes.port");
const media_port_1 = require("../ports/media.port");
const deal_request_lifecycle_service_1 = require("./deal-request-lifecycle.service");
const toDate = (d) => (d ? new Date(`${d}T00:00:00.000Z`) : null);
/**
 * 내놓기/구하기 from the requester's side: create (login + rate limit + daily cap + active cap),
 * own list/detail with proposals, cancel/close, and per-agency contact consent.
 */
let DealRequestsService = DealRequestsService_1 = class DealRequestsService {
    constructor(prisma, config, dailyCaps, mapper, notifications, lifecycle, agencyService, terms, agencies, complexes, media, queue) {
        this.prisma = prisma;
        this.config = config;
        this.dailyCaps = dailyCaps;
        this.mapper = mapper;
        this.notifications = notifications;
        this.lifecycle = lifecycle;
        this.agencyService = agencyService;
        this.terms = terms;
        this.agencies = agencies;
        this.complexes = complexes;
        this.media = media;
        this.queue = queue;
        this.logger = new common_1.Logger(DealRequestsService_1.name);
    }
    async create(user, input, now = new Date()) {
        const sggCode = this.config.get('REGION_SGG_CODE');
        const active = await this.prisma.dealRequest.count({
            where: {
                userId: user.userId,
                status: { in: [...shared_1.DEAL_REQUEST_ACTIVE_STATUSES] },
                deletedAt: null,
            },
        });
        if (active >= shared_1.DEAL_REQUEST_LIMITS.MAX_ACTIVE_PER_USER) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.DEAL_REQUEST_ACTIVE_LIMIT, {
                limit: shared_1.DEAL_REQUEST_LIMITS.MAX_ACTIVE_PER_USER,
            });
        }
        const place = input.type === shared_1.DealRequestType.SELL_OR_LEASE
            ? await this.resolveSellPlace(input, sggCode)
            : await this.validateWanted(input, sggCode);
        if (input.visibility === shared_1.DealRequestVisibility.SELECTED_AGENCIES) {
            const approved = await this.agencies.approvedIds(input.targetAgencyIds);
            const invalid = input.targetAgencyIds.filter((id) => !approved.has(id));
            if (invalid.length > 0) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.DEAL_REQUEST_TARGET_INVALID, {
                    agencyIds: invalid,
                });
            }
        }
        const photoIds = input.type === shared_1.DealRequestType.SELL_OR_LEASE ? input.photoMediaIds : [];
        await this.media.assertPhotosUsable(photoIds, user.userId);
        // 개인정보 수집·이용 + 제3자 제공 동의 (D8): checked before the daily cap is consumed.
        await this.terms.verifyActionConsents(shared_1.ACTION_CONSENT_TERMS.DEAL_REQUEST, input.consents, now);
        // Counted only once the request is known to be valid (the attempt is what we cap).
        await this.dailyCaps.consume('DEAL_REQUEST_CREATE', user.userId, now);
        const id = await this.prisma.$transaction(async (tx) => {
            await this.media.assertPhotosUsable(photoIds, user.userId, tx);
            await this.terms.consentForAction(tx, user.userId, shared_1.ACTION_CONSENT_TERMS.DEAL_REQUEST, input.consents, now);
            const row = await tx.dealRequest.create({
                data: this.createData(user.userId, input, sggCode, place, now),
                select: { id: true },
            });
            if (input.visibility === shared_1.DealRequestVisibility.SELECTED_AGENCIES) {
                await tx.dealRequestTarget.createMany({
                    data: input.targetAgencyIds.map((agencyId) => ({ dealRequestId: row.id, agencyId })),
                });
            }
            if (photoIds.length > 0) {
                await tx.dealRequestPhoto.createMany({
                    data: photoIds.map((mediaId, i) => ({ dealRequestId: row.id, mediaId, sortOrder: i })),
                });
            }
            return row.id;
        });
        await this.enqueueFanout(id);
        return this.mapper.owner(await this.loadOwned(user.userId, id));
    }
    async listMine(user, q) {
        const where = {
            userId: user.userId,
            deletedAt: null,
            ...(q.status?.length ? { status: { in: q.status } } : {}),
            ...(q.type ? { type: q.type } : {}),
        };
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.dealRequest.findMany({
            where,
            select: deal_request_selects_1.dealRequestOwnerSelect,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...args,
        }), () => this.prisma.dealRequest.count({ where }));
        return { ...page, items: page.items.map((r) => this.mapper.owner(r)) };
    }
    /** Own request with its proposals; opening it marks SENT proposals as VIEWED (read receipt). */
    async getMine(user, id, now = new Date()) {
        const row = await this.loadOwned(user.userId, id);
        await this.prisma.proposal.updateMany({
            where: { dealRequestId: id, status: shared_1.ProposalStatus.SENT },
            data: { status: shared_1.ProposalStatus.VIEWED, viewedAt: now },
        });
        const proposals = await this.prisma.proposal.findMany({
            where: { dealRequestId: id, status: { not: shared_1.ProposalStatus.WITHDRAWN } },
            select: deal_request_selects_1.proposalOwnerSelect,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        const disclosures = await this.agencyService.getDisclosures(proposals.map((p) => p.agencyId));
        const granted = new Set(row.contactGrants.map((g) => g.agencyId));
        return {
            ...this.mapper.owner(row),
            proposals: proposals.map((p) => this.mapper.proposalForOwner(p, disclosures.get(p.agencyId) ?? null, granted.has(p.agencyId))),
        };
    }
    cancel(user, id, now = new Date()) {
        return this.end(user, id, shared_1.DealRequestStatus.CANCELLED, null, now);
    }
    /**
     * Extends an OPEN request, or reopens an EXPIRED one, for another TTL_DAYS (at most
     * MAX_EXTENSIONS times). Reopening counts toward MAX_ACTIVE_PER_USER; requests whose contact was
     * already erased cannot come back. Serialized per member so concurrent calls cannot exceed caps.
     */
    async extend(user, id, now = new Date()) {
        await this.prisma.$transaction(async (tx) => {
            const lockKey = `deal-request-active:${user.userId}`;
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
            const req = await tx.dealRequest.findFirst({
                where: { id, userId: user.userId, deletedAt: null },
                select: { status: true, extensionCount: true, contactScrubbedAt: true },
            });
            if (!req)
                throw app_exception_1.AppException.notFound(shared_1.ErrorCode.DEAL_REQUEST_NOT_FOUND);
            const extendable = [shared_1.DealRequestStatus.OPEN, shared_1.DealRequestStatus.EXPIRED];
            if (!extendable.includes(req.status) || req.contactScrubbedAt !== null) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.DEAL_REQUEST_STATE_INVALID);
            }
            if (req.extensionCount >= shared_1.DEAL_REQUEST_LIMITS.MAX_EXTENSIONS) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.DEAL_REQUEST_EXTEND_LIMIT, {
                    limit: shared_1.DEAL_REQUEST_LIMITS.MAX_EXTENSIONS,
                });
            }
            if (req.status === shared_1.DealRequestStatus.EXPIRED) {
                const active = await tx.dealRequest.count({
                    where: {
                        userId: user.userId,
                        status: { in: [...shared_1.DEAL_REQUEST_ACTIVE_STATUSES] },
                        deletedAt: null,
                    },
                });
                if (active >= shared_1.DEAL_REQUEST_LIMITS.MAX_ACTIVE_PER_USER) {
                    throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.DEAL_REQUEST_ACTIVE_LIMIT, {
                        limit: shared_1.DEAL_REQUEST_LIMITS.MAX_ACTIVE_PER_USER,
                    });
                }
            }
            const { count } = await tx.dealRequest.updateMany({
                where: {
                    id,
                    status: req.status,
                    extensionCount: req.extensionCount,
                    contactScrubbedAt: null,
                },
                data: {
                    status: shared_1.DealRequestStatus.OPEN,
                    expiresAt: (0, shared_1.dealRequestExpiry)(now, shared_1.DEAL_REQUEST_LIMITS.TTL_DAYS),
                    closedAt: null,
                    extensionCount: { increment: 1 },
                },
            });
            if (count === 0)
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.DEAL_REQUEST_STATE_INVALID);
        });
        return this.mapper.owner(await this.loadOwned(user.userId, id));
    }
    close(user, id, input, now = new Date()) {
        return this.end(user, id, shared_1.DealRequestStatus.CLOSED, input.reason ?? null, now);
    }
    /**
     * The requester's consent to reveal contact name/phone and 동·호 to one agency. Allowed for agencies
     * the requester selected or that sent a (non-withdrawn) proposal. Idempotent.
     */
    async grantContact(user, id, agencyId, now = new Date()) {
        const req = await this.findOwned(user.userId, id);
        if (!shared_1.DEAL_REQUEST_ACTIVE_STATUSES.includes(req.status)) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.DEAL_REQUEST_STATE_INVALID);
        }
        const [approved, related] = await Promise.all([
            this.agencies.approvedIds([agencyId]),
            this.prisma.dealRequest.count({
                where: {
                    id,
                    OR: [
                        { targets: { some: { agencyId } } },
                        { proposals: { some: { agencyId, status: { not: shared_1.ProposalStatus.WITHDRAWN } } } },
                    ],
                },
            }),
        ]);
        if (!approved.has(agencyId) || related === 0) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.DEAL_REQUEST_GRANT_INVALID);
        }
        const sent = await this.prisma.$transaction(async (tx) => {
            const created = await this.lifecycle.grant(tx, id, agencyId, now);
            if (!created)
                return [];
            const recipients = (await this.agencies.memberRecipients([agencyId], tx)).filter((r) => r.userId !== user.userId);
            return this.notifications.createForMembers(recipients, {
                type: shared_1.NotificationType.CONTACT_GRANTED,
                title: '요청자가 연락처를 공개했습니다.',
                data: { dealRequestId: id },
            }, tx);
        });
        await this.notifications.dispatch(sent);
        const grant = await this.prisma.dealRequestContactGrant.findUniqueOrThrow({
            where: { dealRequestId_agencyId: { dealRequestId: id, agencyId } },
            select: { agencyId: true, grantedAt: true, agency: { select: { name: true } } },
        });
        return {
            agencyId: grant.agencyId,
            agencyName: grant.agency.name,
            grantedAt: grant.grantedAt.toISOString(),
        };
    }
    async revokeContact(user, id, agencyId, now = new Date()) {
        await this.findOwned(user.userId, id);
        const { count } = await this.prisma.dealRequestContactGrant.updateMany({
            where: { dealRequestId: id, agencyId, revokedAt: null },
            data: { revokedAt: now },
        });
        if (count === 0)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.DEAL_REQUEST_GRANT_NOT_FOUND);
    }
    // ---------------------------------------------------------------------------------------------
    async end(user, id, to, reason, now) {
        await this.findOwned(user.userId, id);
        const sent = await this.prisma.$transaction((tx) => this.lifecycle.end(tx, {
            dealRequestId: id,
            to,
            reason,
            revokeGrants: to === shared_1.DealRequestStatus.CANCELLED,
            actorUserId: user.userId,
            now,
        }));
        await this.notifications.dispatch(sent);
        return this.mapper.owner(await this.loadOwned(user.userId, id));
    }
    async findOwned(userId, id) {
        const row = await this.prisma.dealRequest.findFirst({
            where: { id, userId, deletedAt: null },
            select: { id: true, status: true },
        });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.DEAL_REQUEST_NOT_FOUND);
        return row;
    }
    async loadOwned(userId, id) {
        const row = await this.prisma.dealRequest.findFirst({
            where: { id, userId, deletedAt: null },
            select: deal_request_selects_1.dealRequestOwnerSelect,
        });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.DEAL_REQUEST_NOT_FOUND);
        return row;
    }
    async resolveSellPlace(input, sggCode) {
        if (input.emdCode && !(0, shared_1.regionCodesWithinSgg)([input.emdCode], sggCode)) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.DEAL_REQUEST_REGION_INVALID, { path: ['emdCode'] });
        }
        let complex = null;
        if (input.complexId) {
            const [row] = await this.complexes.findActive([input.complexId]);
            if (!row || row.sggCode !== sggCode || row.assetType !== input.assetType) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.DEAL_REQUEST_COMPLEX_INVALID, {
                    complexIds: [input.complexId],
                });
            }
            complex = row;
        }
        return {
            emdCode: input.emdCode ?? complex?.emdCode ?? null,
            lat: input.lat ?? complex?.lat ?? null,
            lng: input.lng ?? complex?.lng ?? null,
        };
    }
    async validateWanted(input, sggCode) {
        if (!(0, shared_1.regionCodesWithinSgg)(input.regionCodes, sggCode)) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.DEAL_REQUEST_REGION_INVALID, {
                path: ['regionCodes'],
            });
        }
        if (input.complexIds.length > 0) {
            const ids = [...new Set(input.complexIds)];
            const rows = await this.complexes.findActive(ids);
            const ok = new Set(rows
                .filter((r) => r.sggCode === sggCode &&
                r.assetType === input.assetType &&
                shared_1.COMPLEX_ASSET_TYPES.includes(r.assetType))
                .map((r) => r.id));
            const invalid = ids.filter((id) => !ok.has(id));
            if (invalid.length > 0) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.DEAL_REQUEST_COMPLEX_INVALID, {
                    complexIds: invalid,
                });
            }
        }
        return { emdCode: null, lat: null, lng: null };
    }
    createData(userId, input, sggCode, place, now) {
        const common = {
            type: input.type,
            userId,
            status: shared_1.DealRequestStatus.OPEN,
            assetType: input.assetType,
            dealTypes: input.dealTypes,
            visibility: input.visibility,
            sggCode,
            contactName: input.contactName,
            contactPhone: input.contactPhone,
            description: input.description ?? null,
            moveInDate: toDate(input.moveInDate),
            expiresAt: (0, shared_1.dealRequestExpiry)(now, shared_1.DEAL_REQUEST_LIMITS.TTL_DAYS),
            emdCode: place.emdCode,
            lat: place.lat,
            lng: place.lng,
        };
        if (input.type === shared_1.DealRequestType.SELL_OR_LEASE) {
            return {
                ...common,
                roadAddress: input.roadAddress,
                addressDetail: input.addressDetail ?? null,
                complexId: input.complexId ?? null,
                exclusiveArea: input.exclusiveArea ?? null,
                floor: input.floor ?? null,
                desiredSalePrice: input.desiredSalePrice ?? null,
                desiredDeposit: input.desiredDeposit ?? null,
                desiredMonthlyRent: input.desiredMonthlyRent ?? null,
            };
        }
        return {
            ...common,
            regionCodes: [...new Set(input.regionCodes)],
            complexIds: [...new Set(input.complexIds)],
            priceMin: input.priceMin ?? null,
            priceMax: input.priceMax ?? null,
            depositMin: input.depositMin ?? null,
            depositMax: input.depositMax ?? null,
            rentMin: input.rentMin ?? null,
            rentMax: input.rentMax ?? null,
            areaMin: input.areaMin ?? null,
            areaMax: input.areaMax ?? null,
            roomsMin: input.roomsMin ?? null,
        };
    }
    /** Fan-out runs in the worker; a failed enqueue only delays agency notifications. */
    async enqueueFanout(dealRequestId) {
        try {
            await this.queue.add(constants_1.DEAL_REQUEST_JOBS.FANOUT, { dealRequestId }, { jobId: `fanout-${dealRequestId}` });
        }
        catch (err) {
            this.logger.warn({ err, dealRequestId }, 'deal request fan-out enqueue failed');
        }
    }
};
exports.DealRequestsService = DealRequestsService;
exports.DealRequestsService = DealRequestsService = DealRequestsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(8, (0, common_1.Inject)(agency_directory_port_1.DEAL_REQUEST_AGENCIES)),
    __param(9, (0, common_1.Inject)(complexes_port_1.DEAL_REQUEST_COMPLEXES)),
    __param(10, (0, common_1.Inject)(media_port_1.DEAL_REQUEST_MEDIA)),
    __param(11, (0, bullmq_1.InjectQueue)(constants_1.DEAL_REQUESTS_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        app_config_service_1.AppConfig,
        daily_cap_service_1.DailyCapService,
        deal_request_mapper_1.DealRequestMapper,
        notifications_service_1.NotificationsService,
        deal_request_lifecycle_service_1.DealRequestLifecycleService,
        agencies_service_1.AgenciesService,
        auth_1.TermsService, Object, Object, Object, Function])
], DealRequestsService);
//# sourceMappingURL=deal-requests.service.js.map