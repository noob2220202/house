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
exports.ReportsService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const audit_service_1 = require("../../../common/audit/audit.service");
const request_context_1 = require("../../../common/context/request-context");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const daily_cap_service_1 = require("../../../common/throttle/daily-cap.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const agencies_service_1 = require("../../agencies/services/agencies.service");
const notifications_service_1 = require("../../deal-requests/notifications/notifications.service");
const admin_mapper_1 = require("../admin.mapper");
const constants_1 = require("../constants");
const listing_moderation_port_1 = require("../ports/listing-moderation.port");
/**
 * 허위매물 신고: creation by logged-in users (rate limit + daily cap + one open report per
 * user and target) and the back-office workflow RECEIVED → IN_REVIEW → RESOLVED | REJECTED.
 * Resolution can hide the listing (listings module) and/or warn the agency (agencies module).
 */
let ReportsService = class ReportsService {
    constructor(prisma, audit, dailyCaps, agencies, notifications, moderation) {
        this.prisma = prisma;
        this.audit = audit;
        this.dailyCaps = dailyCaps;
        this.agencies = agencies;
        this.notifications = notifications;
        this.moderation = moderation;
    }
    // ------------------------------------------------------------------ user side
    async create(user, dto) {
        const target = await this.resolveTarget(dto.targetType, dto.targetId);
        await this.dailyCaps.consume('REPORT_CREATE', user.userId);
        const ip = request_context_1.RequestContext.current()?.ip?.slice(0, 64) ?? null;
        const report = await this.prisma.$transaction(async (tx) => {
            // One open report per (user, target): serialize concurrent submissions of the same pair.
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`report:${user.userId}:${dto.targetId}`}))`;
            const open = await tx.report.findFirst({
                where: {
                    reporterUserId: user.userId,
                    targetType: dto.targetType,
                    ...(dto.targetType === shared_1.ReportTargetType.LISTING
                        ? { listingId: dto.targetId }
                        : { agencyId: dto.targetId }),
                    status: { in: [...shared_1.OPEN_REPORT_STATUSES] },
                },
                select: { id: true },
            });
            if (open)
                throw app_exception_1.AppException.conflict(shared_1.ErrorCode.REPORT_DUPLICATE);
            return tx.report.create({
                data: {
                    targetType: dto.targetType,
                    listingId: target.listingId,
                    agencyId: target.agencyId,
                    reporterUserId: user.userId,
                    reporterPhone: dto.reporterPhone ?? null,
                    reason: dto.reason,
                    detail: dto.detail || null,
                    ip,
                },
                select: { id: true, status: true, createdAt: true },
            });
        });
        return { id: report.id, status: report.status, createdAt: report.createdAt.toISOString() };
    }
    /** Users can report what they can see: public listings and approved agencies. */
    async resolveTarget(type, id) {
        if (type === shared_1.ReportTargetType.LISTING) {
            const listing = await this.prisma.listing.findFirst({
                where: { id, deletedAt: null, status: { in: [...shared_1.PUBLIC_LISTING_STATUSES] } },
                select: { id: true, primaryAgencyId: true },
            });
            if (!listing)
                throw app_exception_1.AppException.notFound(shared_1.ErrorCode.REPORT_TARGET_NOT_FOUND);
            return { listingId: listing.id, agencyId: listing.primaryAgencyId };
        }
        const agency = await this.prisma.agency.findFirst({
            where: { id, deletedAt: null, status: shared_1.AgencyStatus.APPROVED },
            select: { id: true },
        });
        if (!agency)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.REPORT_TARGET_NOT_FOUND);
        return { listingId: null, agencyId: agency.id };
    }
    // ------------------------------------------------------------------ admin side
    async list(q) {
        const where = {
            ...(q.status ? { status: q.status } : {}),
            ...(q.targetType ? { targetType: q.targetType } : {}),
            ...(q.reason ? { reason: q.reason } : {}),
            ...(q.listingId ? { listingId: q.listingId } : {}),
            ...(q.agencyId ? { agencyId: q.agencyId } : {}),
        };
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.report.findMany({
            where,
            select: admin_mapper_1.reportSelect,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...args,
        }), () => this.prisma.report.count({ where }));
        return { ...page, items: page.items.map((r) => (0, admin_mapper_1.toAdminReportView)(r)) };
    }
    /**
     * Full view including the reporter's callback number. Viewing it is a 개인정보 접속기록
     * (안전성 확보조치 기준 제8조), so it writes a `report.pii-view` audit row (no PII in the row).
     */
    async detail(id) {
        const row = await this.load(id);
        if (row.reporterPhone) {
            await this.audit.record({
                action: 'report.pii-view',
                resourceType: 'Report',
                resourceId: id,
                after: { fields: ['reporterPhone'] },
            });
        }
        return (0, admin_mapper_1.toAdminReportView)(row, { revealContact: true });
    }
    /** Masked view returned by mutations (and therefore stored in their audit rows). */
    async view(id, db = this.prisma) {
        return (0, admin_mapper_1.toAdminReportView)(await this.load(id, db));
    }
    /**
     * Retention of the reporter's contact data: once a report has been closed for
     * REPORT_CONTACT_RETENTION_DAYS, its callback number and source ip have served their purpose
     * and are erased (withdrawn reporters are scrubbed earlier by the auth module's PiiScrubService).
     * Idempotent; returns the number of reports scrubbed.
     */
    async scrubExpiredContacts(now = new Date()) {
        const cutoff = new Date(now.getTime() - constants_1.REPORT_CONTACT_RETENTION_DAYS * 86_400_000);
        const { count } = await this.prisma.report.updateMany({
            where: {
                status: { notIn: [...shared_1.OPEN_REPORT_STATUSES] },
                handledAt: { lt: cutoff },
                OR: [{ reporterPhone: { not: null } }, { ip: { not: null } }],
            },
            data: { reporterPhone: null, ip: null },
        });
        return count;
    }
    /** Takes the report into review and/or records an internal note. */
    async review(id, dto, admin) {
        const before = await this.load(id);
        if (!(0, shared_1.isReportOpen)(before.status))
            throw app_exception_1.AppException.conflict(shared_1.ErrorCode.REPORT_ALREADY_HANDLED);
        request_context_1.RequestContext.setAuditBefore((0, admin_mapper_1.toAdminReportView)(before));
        const { count } = await this.prisma.report.updateMany({
            where: { id, status: { in: [...shared_1.OPEN_REPORT_STATUSES] } },
            data: {
                ...(dto.status ? { status: dto.status } : {}),
                ...(dto.note !== undefined ? { resolutionNote: dto.note || null } : {}),
                handledByAdminId: admin.adminId,
            },
        });
        if (count === 0)
            throw app_exception_1.AppException.conflict(shared_1.ErrorCode.REPORT_ALREADY_HANDLED);
        return this.view(id);
    }
    async resolve(id, dto, admin) {
        const before = await this.load(id);
        if (!(0, shared_1.isReportOpen)(before.status))
            throw app_exception_1.AppException.conflict(shared_1.ErrorCode.REPORT_ALREADY_HANDLED);
        const hideListing = dto.status === shared_1.ReportStatus.RESOLVED && (0, shared_1.reportActionHidesListing)(dto.action);
        const warnAgency = dto.status === shared_1.ReportStatus.RESOLVED && (0, shared_1.reportActionWarnsAgency)(dto.action);
        if (!(0, shared_1.isReportActionAllowed)(before.targetType, dto.status, dto.action) ||
            (hideListing && (!before.listing || before.listing.deletedAt)) ||
            (warnAgency && !before.agencyId)) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.REPORT_ACTION_INVALID, {
                targetType: before.targetType,
                action: dto.action,
            });
        }
        const listingId = before.listingId;
        const notifications = await this.prisma.$transaction(async (tx) => {
            const { count } = await tx.report.updateMany({
                where: { id, status: { in: [...shared_1.OPEN_REPORT_STATUSES] } },
                data: {
                    status: dto.status,
                    action: dto.action,
                    resolutionNote: dto.note ?? before.resolutionNote,
                    handledByAdminId: admin.adminId,
                    handledAt: new Date(),
                },
            });
            if (count === 0)
                throw app_exception_1.AppException.conflict(shared_1.ErrorCode.REPORT_ALREADY_HANDLED);
            // Only the admin who claimed the report above gets here, so a concurrent REJECTED decision
            // can never leave the listing hidden.
            if (hideListing && listingId) {
                await this.moderation.hide(listingId, `허위매물 신고 처리: ${shared_1.REPORT_REASON_LABEL[before.reason]}`, tx);
            }
            if (warnAgency && before.agencyId) {
                await this.agencies.recordWarning({
                    agencyId: before.agencyId,
                    reason: `허위매물 신고 처리: ${shared_1.REPORT_REASON_LABEL[before.reason]}${dto.note ? ` — ${dto.note}` : ''}`.slice(0, 1000),
                    reportId: id,
                    adminId: admin.adminId,
                }, tx);
            }
            const rows = await this.notify(tx, before, dto, hideListing);
            const after = await this.view(id, tx);
            await this.audit.record({
                action: 'report.resolve',
                resourceType: 'Report',
                resourceId: id,
                before: (0, admin_mapper_1.toAdminReportView)(before),
                after,
            }, tx);
            return rows;
        });
        if (hideListing)
            await this.moderation.invalidateSearch();
        await this.notifications.dispatch(notifications);
        return this.view(id);
    }
    async notify(tx, report, dto, hideListing) {
        const rows = [];
        if (report.reporterUserId) {
            rows.push(...(await this.notifications.createFor([report.reporterUserId], {
                type: shared_1.NotificationType.REPORT_RESOLVED,
                title: dto.status === shared_1.ReportStatus.RESOLVED
                    ? '신고하신 내용이 처리되었습니다.'
                    : '신고하신 내용을 검토한 결과 조치하지 않기로 했습니다.',
                body: dto.status === shared_1.ReportStatus.RESOLVED ? shared_1.REPORT_ACTION_LABEL[dto.action] : null,
                data: { reportId: report.id },
            }, tx)));
        }
        if (hideListing && report.listingId && report.agencyId) {
            const agency = await tx.agency.findUnique({
                where: { id: report.agencyId },
                select: { ownerUserId: true },
            });
            if (agency) {
                rows.push(...(await this.notifications.createFor([agency.ownerUserId], {
                    type: shared_1.NotificationType.LISTING_HIDDEN,
                    title: '허위매물 신고로 매물이 숨김 처리되었습니다.',
                    body: shared_1.REPORT_REASON_LABEL[report.reason],
                    data: { listingId: report.listingId, reportId: report.id },
                }, tx)));
            }
        }
        return rows;
    }
    async load(id, db = this.prisma) {
        const row = await db.report.findUnique({ where: { id }, select: admin_mapper_1.reportSelect });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.REPORT_NOT_FOUND);
        return row;
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, common_1.Inject)(listing_moderation_port_1.LISTING_MODERATION)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        daily_cap_service_1.DailyCapService,
        agencies_service_1.AgenciesService,
        notifications_service_1.NotificationsService, Object])
], ReportsService);
//# sourceMappingURL=reports.service.js.map