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
var DealRequestMaintenanceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DealRequestMaintenanceService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../constants");
const notifications_service_1 = require("../notifications/notifications.service");
const agency_directory_port_1 = require("../ports/agency-directory.port");
const media_port_1 = require("../ports/media.port");
const ENDED_STATUSES = [
    shared_1.DealRequestStatus.CLOSED,
    shared_1.DealRequestStatus.CANCELLED,
    shared_1.DealRequestStatus.EXPIRED,
];
const WITHDRAWAL_REASON = '회원 탈퇴';
/** Withdrawn members' requests that still hold anything identifying. */
const WITHDRAWN_RESIDUE = {
    user: { status: shared_1.UserStatus.WITHDRAWN },
    OR: [
        { contactScrubbedAt: null },
        { roadAddress: { not: null } },
        { lat: { not: null } },
        { floor: { not: null } },
        { description: { not: null } },
        { exclusiveArea: { not: null } },
        { photos: { some: {} } },
    ],
};
/**
 * Background work of the module (run by DealRequestsProcessor; e2e calls these directly). Every
 * method is idempotent and safe to run concurrently with itself.
 */
let DealRequestMaintenanceService = DealRequestMaintenanceService_1 = class DealRequestMaintenanceService {
    constructor(prisma, notifications, agencies, media) {
        this.prisma = prisma;
        this.notifications = notifications;
        this.agencies = agencies;
        this.media = media;
        this.logger = new common_1.Logger(DealRequestMaintenanceService_1.name);
    }
    /**
     * Notifies every broker who can see a new OPEN request (DEAL_REQUEST_RECEIVED). Serialized per
     * request with an advisory lock; users already notified for it are skipped, so retries and
     * duplicate jobs never notify twice.
     */
    async fanout(dealRequestId) {
        const sent = await this.prisma.$transaction(async (tx) => {
            const lockKey = `deal-request-fanout:${dealRequestId}`;
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
            const req = await tx.dealRequest.findFirst({
                // A request flagged as spam before the job ran reaches nobody.
                where: {
                    id: dealRequestId,
                    status: shared_1.DealRequestStatus.OPEN,
                    deletedAt: null,
                    spamFlaggedAt: null,
                },
                select: {
                    id: true,
                    type: true,
                    userId: true,
                    assetType: true,
                    dealTypes: true,
                    visibility: true,
                    sggCode: true,
                    targets: { select: { agencyId: true } },
                },
            });
            if (!req)
                return [];
            const input = {
                type: shared_1.NotificationType.DEAL_REQUEST_RECEIVED,
                title: `새 ${shared_1.DEAL_REQUEST_TYPE_LABEL[req.type]} 요청이 도착했습니다.`,
                body: `${shared_1.ASSET_TYPE_LABEL[req.assetType]} · ${req.dealTypes.map((d) => shared_1.DEAL_TYPE_LABEL[d]).join('/')}`,
                data: { dealRequestId: req.id },
            };
            const out = [];
            const notify = async (recipients) => {
                const fresh = new Set(await this.notYetNotified(tx, req.id, recipients.map((r) => r.userId).filter((u) => u !== req.userId)));
                out.push(...(await this.notifications.createForMembers(recipients.filter((r) => fresh.has(r.userId)), input, tx)));
            };
            if (req.visibility === shared_1.DealRequestVisibility.SELECTED_AGENCIES) {
                const approved = await this.agencies.approvedIds(req.targets.map((t) => t.agencyId), tx);
                await notify(await this.agencies.memberRecipients([...approved], tx));
            }
            else {
                let after = null;
                do {
                    const batch = await this.agencies.regionMemberBatch(req.sggCode, after, tx);
                    await notify(batch.recipients);
                    after = batch.last;
                } while (after);
            }
            return out;
        }, { timeout: 60_000 });
        await this.notifications.dispatch(sent);
        return sent.length;
    }
    /**
     * OPEN requests past expiresAt → EXPIRED, with a notice to the requester. MATCHED requests never
     * expire: an agency is mid-deal with the requester, who ends the request by closing or cancelling
     * it. Expired requests can be reopened with POST /me/deal-requests/:id/extend.
     */
    async expireDue(now = new Date()) {
        let total = 0;
        for (;;) {
            const sent = await this.prisma.$transaction(async (tx) => {
                const rows = await tx.$queryRaw `
          UPDATE deal_requests
          SET status = 'EXPIRED'::deal_request_status, closed_at = ${now}, updated_at = ${now}
          WHERE id IN (
            SELECT id FROM deal_requests
            WHERE status = 'OPEN'::deal_request_status
              AND deleted_at IS NULL
              AND expires_at <= ${now}
            ORDER BY expires_at
            LIMIT ${constants_1.JOB_BATCH_SIZE}
            FOR UPDATE SKIP LOCKED
          )
          RETURNING id, user_id AS "userId"`;
                const notices = await this.notifications.createEach(rows.map((r) => ({
                    userId: r.userId,
                    type: shared_1.NotificationType.SYSTEM,
                    title: '등록하신 요청의 기간이 만료되었습니다.',
                    body: '요청 상세에서 기간을 연장하면 다시 진행할 수 있습니다.',
                    data: { dealRequestId: r.id, status: shared_1.DealRequestStatus.EXPIRED },
                })), tx);
                return { count: rows.length, notices };
            });
            total += sent.count;
            await this.notifications.dispatch(sent.notices);
            if (sent.count < constants_1.JOB_BATCH_SIZE)
                break;
        }
        if (total > 0)
            this.logger.log({ count: total }, 'expired deal requests');
        return total;
    }
    /**
     * Data minimization, two passes:
     *  - requests that ended more than CONTACT_RETENTION_DAYS ago lose contact name/phone and 동·호;
     *  - requests of withdrawn members are cancelled (agencies told) and lose everything identifying
     *    (see eraseWithdrawn). AccountService.withdraw should do this at once via scrubUser; this pass
     *    is the safety net.
     * Contact grants are revoked with both.
     */
    async scrubDue(now = new Date()) {
        const cutoff = new Date(now.getTime() - shared_1.DEAL_REQUEST_LIMITS.CONTACT_RETENTION_DAYS * 86_400_000);
        let total = 0;
        for (;;) {
            const batch = await this.prisma.dealRequest.findMany({
                where: {
                    contactScrubbedAt: null,
                    status: { in: ENDED_STATUSES },
                    closedAt: { lte: cutoff },
                    user: { status: { not: shared_1.UserStatus.WITHDRAWN } },
                },
                select: { id: true },
                orderBy: { id: 'asc' },
                take: constants_1.JOB_BATCH_SIZE,
            });
            if (batch.length === 0)
                break;
            const ids = batch.map((r) => r.id);
            await this.prisma.$transaction(async (tx) => {
                await this.revokeGrants(tx, ids, now);
                await tx.dealRequest.updateMany({
                    where: { id: { in: ids }, contactScrubbedAt: null },
                    data: { contactName: '', contactPhone: '', addressDetail: null, contactScrubbedAt: now },
                });
            });
            total += ids.length;
            if (batch.length < constants_1.JOB_BATCH_SIZE)
                break;
        }
        for (;;) {
            const batch = await this.prisma.dealRequest.findMany({
                where: WITHDRAWN_RESIDUE,
                select: { id: true },
                orderBy: { id: 'asc' },
                take: constants_1.JOB_BATCH_SIZE,
            });
            if (batch.length === 0)
                break;
            const ids = batch.map((r) => r.id);
            const notices = await this.prisma.$transaction((tx) => this.eraseWithdrawn(tx, ids, now));
            await this.notifications.dispatch(notices);
            total += ids.length;
            if (batch.length < constants_1.JOB_BATCH_SIZE)
                break;
        }
        if (total > 0)
            this.logger.log({ count: total }, 'scrubbed deal request contacts');
        return total;
    }
    /**
     * Immediate erasure for one member (회원 탈퇴): cancels the member's live requests (notifying
     * agencies with live proposals), revokes every contact grant, and erases contact, 동·호, address,
     * position, floor, area, description and photos of all their requests.
     *
     * With `tx` (e.g. the withdrawal transaction) the caller must pass the returned notices to
     * `dispatch` after commit; without it, this runs its own transaction and dispatches itself.
     */
    async scrubUser(userId, now = new Date(), tx) {
        const run = async (db) => {
            const rows = await db.dealRequest.findMany({ where: { userId }, select: { id: true } });
            return this.eraseWithdrawn(db, rows.map((r) => r.id), now);
        };
        if (tx)
            return run(tx);
        const notices = await this.prisma.$transaction(run);
        await this.notifications.dispatch(notices);
        return notices;
    }
    /** Best-effort delivery of notices returned by `scrubUser(…, tx)` once its transaction commits. */
    dispatch(notices) {
        return this.notifications.dispatch(notices);
    }
    async eraseWithdrawn(tx, ids, now) {
        if (ids.length === 0)
            return [];
        const cancelled = await tx.$queryRaw `
      UPDATE deal_requests
      SET status = 'CANCELLED'::deal_request_status, closed_at = ${now},
          close_reason = ${WITHDRAWAL_REASON}, updated_at = ${now}
      WHERE id = ANY(${[...ids]}::uuid[])
        AND status IN ('OPEN'::deal_request_status, 'MATCHED'::deal_request_status)
      RETURNING id`;
        const notices = await this.notifyCancelled(tx, cancelled.map((r) => r.id));
        await this.revokeGrants(tx, ids, now);
        await this.media.discardPhotos(ids, now, tx);
        // lat/lng → NULL also clears `location` (deal_requests_sync_location trigger).
        await tx.dealRequest.updateMany({
            where: { id: { in: [...ids] } },
            data: {
                contactName: '',
                contactPhone: '',
                addressDetail: null,
                roadAddress: null,
                lat: null,
                lng: null,
                floor: null,
                exclusiveArea: null,
                description: null,
                contactScrubbedAt: now,
            },
        });
        return notices;
    }
    /** Same notice as DealRequestLifecycleService.end, for agencies with live proposals. */
    async notifyCancelled(tx, ids) {
        if (ids.length === 0)
            return [];
        const proposals = await tx.proposal.findMany({
            where: {
                dealRequestId: { in: [...ids] },
                status: { in: [shared_1.ProposalStatus.SENT, shared_1.ProposalStatus.VIEWED, shared_1.ProposalStatus.ACCEPTED] },
            },
            select: { dealRequestId: true, agencyId: true },
        });
        const byRequest = new Map();
        for (const p of proposals) {
            byRequest.set(p.dealRequestId, [...(byRequest.get(p.dealRequestId) ?? []), p.agencyId]);
        }
        const out = [];
        for (const [dealRequestId, agencyIds] of byRequest) {
            const recipients = await this.agencies.memberRecipients(agencyIds, tx);
            out.push(...(await this.notifications.createForMembers(recipients, {
                type: shared_1.NotificationType.SYSTEM,
                title: `제안하신 요청이 ${shared_1.DEAL_REQUEST_STATUS_LABEL[shared_1.DealRequestStatus.CANCELLED]} 처리되었습니다.`,
                body: '요청자가 탈퇴하여 요청이 종료되었습니다.',
                data: { dealRequestId, status: shared_1.DealRequestStatus.CANCELLED },
            }, tx)));
        }
        return out;
    }
    async revokeGrants(tx, ids, now) {
        await tx.dealRequestContactGrant.updateMany({
            where: { dealRequestId: { in: [...ids] }, revokedAt: null },
            data: { revokedAt: now },
        });
    }
    async notYetNotified(tx, dealRequestId, userIds) {
        if (userIds.length === 0)
            return [];
        const done = await tx.notification.findMany({
            where: {
                userId: { in: userIds },
                type: shared_1.NotificationType.DEAL_REQUEST_RECEIVED,
                data: { path: ['dealRequestId'], equals: dealRequestId },
            },
            select: { userId: true },
        });
        const seen = new Set(done.map((d) => d.userId));
        return [...new Set(userIds)].filter((u) => !seen.has(u));
    }
};
exports.DealRequestMaintenanceService = DealRequestMaintenanceService;
exports.DealRequestMaintenanceService = DealRequestMaintenanceService = DealRequestMaintenanceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(agency_directory_port_1.DEAL_REQUEST_AGENCIES)),
    __param(3, (0, common_1.Inject)(media_port_1.DEAL_REQUEST_MEDIA)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService, Object, Object])
], DealRequestMaintenanceService);
//# sourceMappingURL=deal-request-maintenance.service.js.map