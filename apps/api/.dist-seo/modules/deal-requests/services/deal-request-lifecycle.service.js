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
exports.DealRequestLifecycleService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/errors/app.exception");
const notifications_service_1 = require("../notifications/notifications.service");
const agency_directory_port_1 = require("../ports/agency-directory.port");
/** State transitions shared by the requester and admin flows. */
let DealRequestLifecycleService = class DealRequestLifecycleService {
    constructor(notifications, agencies) {
        this.notifications = notifications;
        this.agencies = agencies;
    }
    /**
     * OPEN/MATCHED → CLOSED/CANCELLED inside `tx` (conditional update, so concurrent transitions
     * cannot both win) and notifies agencies with live proposals. Returns rows to dispatch after commit.
     */
    async end(tx, input) {
        const { dealRequestId: id, now } = input;
        const { count } = await tx.dealRequest.updateMany({
            where: { id, status: { in: [...shared_1.DEAL_REQUEST_ACTIVE_STATUSES] }, deletedAt: null },
            data: { status: input.to, closedAt: now, closeReason: input.reason ?? null },
        });
        if (count === 0)
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.DEAL_REQUEST_STATE_INVALID);
        if (input.revokeGrants) {
            await tx.dealRequestContactGrant.updateMany({
                where: { dealRequestId: id, revokedAt: null },
                data: { revokedAt: now },
            });
        }
        const proposals = await tx.proposal.findMany({
            where: {
                dealRequestId: id,
                status: { in: [shared_1.ProposalStatus.SENT, shared_1.ProposalStatus.VIEWED, shared_1.ProposalStatus.ACCEPTED] },
            },
            select: { agencyId: true },
        });
        const recipients = (await this.agencies.memberRecipients(proposals.map((p) => p.agencyId), tx)).filter((r) => r.userId !== input.actorUserId);
        return this.notifications.createForMembers(recipients, {
            type: shared_1.NotificationType.SYSTEM,
            title: `제안하신 요청이 ${shared_1.DEAL_REQUEST_STATUS_LABEL[input.to]} 처리되었습니다.`,
            data: { dealRequestId: id, status: input.to },
        }, tx);
    }
    /** Creates or re-activates a contact grant. Returns false when it was already active. */
    async grant(tx, dealRequestId, agencyId, now) {
        const existing = await tx.dealRequestContactGrant.findUnique({
            where: { dealRequestId_agencyId: { dealRequestId, agencyId } },
            select: { revokedAt: true },
        });
        if (existing && existing.revokedAt === null)
            return false;
        await tx.dealRequestContactGrant.upsert({
            where: { dealRequestId_agencyId: { dealRequestId, agencyId } },
            create: { dealRequestId, agencyId, grantedAt: now },
            update: { grantedAt: now, revokedAt: null },
        });
        return true;
    }
};
exports.DealRequestLifecycleService = DealRequestLifecycleService;
exports.DealRequestLifecycleService = DealRequestLifecycleService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(agency_directory_port_1.DEAL_REQUEST_AGENCIES)),
    __metadata("design:paramtypes", [notifications_service_1.NotificationsService, Object])
], DealRequestLifecycleService);
//# sourceMappingURL=deal-request-lifecycle.service.js.map