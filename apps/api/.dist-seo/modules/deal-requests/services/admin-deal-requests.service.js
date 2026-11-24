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
exports.AdminDealRequestsService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const request_context_1 = require("../../../common/context/request-context");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const deal_request_mapper_1 = require("../deal-request.mapper");
const deal_request_selects_1 = require("../deal-request.selects");
const notifications_service_1 = require("../notifications/notifications.service");
const deal_request_lifecycle_service_1 = require("./deal-request-lifecycle.service");
/**
 * Back-office moderation of 내놓기/구하기. Admins see the requester id and a masked contact only;
 * closing a request revokes every contact grant and notifies requester + proposing agencies.
 * Flagging a request as spam hides it from every agency (deal-request-access) until cleared; the
 * requester is not told and nothing else about the request changes.
 */
let AdminDealRequestsService = class AdminDealRequestsService {
    constructor(prisma, mapper, notifications, lifecycle) {
        this.prisma = prisma;
        this.mapper = mapper;
        this.notifications = notifications;
        this.lifecycle = lifecycle;
    }
    async list(q) {
        const where = {
            // No automatic abuse signals exist yet: nothing is "suspected".
            ...(q.spam === 'flagged' ? { spamFlaggedAt: { not: null } } : {}),
            ...(q.spam === 'suspected' ? { id: { in: [] } } : {}),
            ...(q.status?.length ? { status: { in: q.status } } : {}),
            ...(q.type ? { type: q.type } : {}),
            ...(q.assetType?.length ? { assetType: { in: q.assetType } } : {}),
            ...(q.userId ? { userId: q.userId } : {}),
            ...(q.agencyId
                ? {
                    OR: [
                        { targets: { some: { agencyId: q.agencyId } } },
                        { proposals: { some: { agencyId: q.agencyId } } },
                    ],
                }
                : {}),
        };
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.dealRequest.findMany({
            where,
            select: deal_request_selects_1.dealRequestAdminSelect,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...args,
        }), () => this.prisma.dealRequest.count({ where }));
        return { ...page, items: page.items.map((r) => this.mapper.admin(r)) };
    }
    async get(id) {
        return this.mapper.admin(await this.load(id));
    }
    async close(id, input, now = new Date()) {
        const before = await this.load(id);
        request_context_1.RequestContext.setAuditBefore(this.mapper.admin(before));
        const sent = await this.prisma.$transaction(async (tx) => {
            const agencyRows = await this.lifecycle.end(tx, {
                dealRequestId: id,
                to: shared_1.DealRequestStatus.CLOSED,
                reason: input.reason,
                revokeGrants: true,
                now,
            });
            const ownerRows = await this.notifications.createFor([before.userId], {
                type: shared_1.NotificationType.SYSTEM,
                title: '운영 정책에 따라 요청이 종료되었습니다.',
                body: input.reason,
                data: { dealRequestId: id },
            }, tx);
            return [...agencyRows, ...ownerRows];
        });
        await this.notifications.dispatch(sent);
        return this.get(id);
    }
    /**
     * Sets or clears the spam flag. Re-flagging a flagged request only replaces the reason (and the
     * admin) and keeps the original flag time; clearing an unflagged one is a no-op.
     */
    async setSpamFlag(id, input, adminId, now = new Date()) {
        const before = await this.load(id);
        request_context_1.RequestContext.setAuditBefore(this.mapper.admin(before));
        await this.prisma.dealRequest.update({
            where: { id },
            data: input.flagged
                ? {
                    spamFlaggedAt: before.spamFlaggedAt ?? now,
                    spamReason: input.reason ?? null,
                    spamFlaggedBy: adminId,
                }
                : { spamFlaggedAt: null, spamReason: null, spamFlaggedBy: null },
        });
        return this.get(id);
    }
    async load(id) {
        const row = await this.prisma.dealRequest.findUnique({
            where: { id },
            select: deal_request_selects_1.dealRequestAdminSelect,
        });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.DEAL_REQUEST_NOT_FOUND);
        return row;
    }
};
exports.AdminDealRequestsService = AdminDealRequestsService;
exports.AdminDealRequestsService = AdminDealRequestsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        deal_request_mapper_1.DealRequestMapper,
        notifications_service_1.NotificationsService,
        deal_request_lifecycle_service_1.DealRequestLifecycleService])
], AdminDealRequestsService);
//# sourceMappingURL=admin-deal-requests.service.js.map