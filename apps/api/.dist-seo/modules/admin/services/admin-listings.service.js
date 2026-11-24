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
exports.AdminListingsService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const request_context_1 = require("../../../common/context/request-context");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const notifications_service_1 = require("../../deal-requests/notifications/notifications.service");
const listing_moderation_port_1 = require("../ports/listing-moderation.port");
const listSelect = {
    id: true,
    status: true,
    dealType: true,
    assetType: true,
    title: true,
    complexId: true,
    salePrice: true,
    deposit: true,
    monthlyRent: true,
    hiddenReason: true,
    viewCount: true,
    publishedAt: true,
    closedAt: true,
    createdAt: true,
    updatedAt: true,
    property: { select: { roadAddress: true } },
    primaryAgency: { select: { id: true, name: true, ownerUserId: true } },
    _count: { select: { reports: { where: { status: { in: [...shared_1.OPEN_REPORT_STATUSES] } } } } },
};
const detailSelect = {
    ...listSelect,
    description: true,
    verifiedAt: true,
    photoCount: true,
    agencies: {
        select: { isPrimary: true, agency: { select: { id: true, name: true } } },
        orderBy: [{ isPrimary: 'desc' }, { joinedAt: 'asc' }],
    },
    reports: {
        select: { id: true, reason: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
    },
};
const iso = (d) => (d ? d.toISOString() : null);
function toListItem(l) {
    return {
        id: l.id,
        status: l.status,
        dealType: l.dealType,
        assetType: l.assetType,
        title: l.title,
        roadAddress: l.property.roadAddress,
        complexId: l.complexId,
        primaryAgency: { id: l.primaryAgency.id, name: l.primaryAgency.name },
        salePrice: l.salePrice,
        deposit: l.deposit,
        monthlyRent: l.monthlyRent,
        hiddenReason: l.hiddenReason,
        openReportCount: l._count.reports,
        viewCount: l.viewCount,
        publishedAt: iso(l.publishedAt),
        closedAt: iso(l.closedAt),
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
    };
}
function toDetail(l) {
    return {
        ...toListItem(l),
        description: l.description,
        verifiedAt: iso(l.verifiedAt),
        photoCount: l.photoCount,
        agencies: l.agencies.map((a) => ({ ...a.agency, isPrimary: a.isPrimary })),
        recentReports: l.reports.map((r) => ({
            id: r.id,
            reason: r.reason,
            status: r.status,
            createdAt: r.createdAt.toISOString(),
        })),
    };
}
/**
 * Back-office listing moderation (all agencies). Reads use the listing tables directly (read-only);
 * state changes go through the listings module (ListingModerationPort) so its counters and map
 * caches stay right. 동·호 (Property.ho) is never selected.
 */
let AdminListingsService = class AdminListingsService {
    constructor(prisma, moderation, notifications) {
        this.prisma = prisma;
        this.moderation = moderation;
        this.notifications = notifications;
    }
    async list(q) {
        const where = {
            deletedAt: null,
            ...(q.status ? { status: q.status } : {}),
            ...(q.dealType ? { dealType: q.dealType } : {}),
            ...(q.assetType ? { assetType: q.assetType } : {}),
            ...(q.agencyId ? { primaryAgencyId: q.agencyId } : {}),
            ...(q.complexId ? { complexId: q.complexId } : {}),
            ...(q.q
                ? {
                    OR: [
                        { title: { contains: q.q, mode: 'insensitive' } },
                        { property: { roadAddress: { contains: q.q, mode: 'insensitive' } } },
                    ],
                }
                : {}),
        };
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.listing.findMany({
            where,
            select: listSelect,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...args,
        }), () => this.prisma.listing.count({ where }));
        return { ...page, items: page.items.map(toListItem) };
    }
    async detail(id) {
        return toDetail(await this.load(id));
    }
    async hide(id, dto) {
        const before = await this.load(id);
        if (before.status === shared_1.ListingStatus.HIDDEN) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.ADMIN_LISTING_INVALID_STATUS);
        }
        request_context_1.RequestContext.setAuditBefore(toDetail(before));
        await this.moderation.hide(id, dto.reason);
        await this.notifyAgency(before, dto.reason);
        return this.detail(id);
    }
    async unhide(id) {
        const before = await this.load(id);
        if (before.status !== shared_1.ListingStatus.HIDDEN) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.ADMIN_LISTING_INVALID_STATUS);
        }
        request_context_1.RequestContext.setAuditBefore(toDetail(before));
        await this.moderation.unhide(id);
        return this.detail(id);
    }
    async forceClose(id, dto) {
        const before = await this.load(id);
        if (before.status === shared_1.ListingStatus.CLOSED) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.ADMIN_LISTING_INVALID_STATUS);
        }
        request_context_1.RequestContext.setAuditBefore(toDetail(before));
        await this.moderation.forceClose(id, dto.reason);
        return this.detail(id);
    }
    async notifyAgency(listing, reason) {
        const rows = await this.notifications.createFor([listing.primaryAgency.ownerUserId], {
            type: shared_1.NotificationType.LISTING_HIDDEN,
            title: '매물이 숨김 처리되었습니다.',
            body: reason.slice(0, 1000),
            data: { listingId: listing.id },
        });
        await this.notifications.dispatch(rows);
    }
    async load(id) {
        const row = await this.prisma.listing.findFirst({
            where: { id, deletedAt: null },
            select: detailSelect,
        });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.ADMIN_LISTING_NOT_FOUND);
        return row;
    }
};
exports.AdminListingsService = AdminListingsService;
exports.AdminListingsService = AdminListingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(listing_moderation_port_1.LISTING_MODERATION)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object, notifications_service_1.NotificationsService])
], AdminListingsService);
//# sourceMappingURL=admin-listings.service.js.map