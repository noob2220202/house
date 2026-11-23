import {
  ASSET_TYPE_LABEL,
  DEAL_REQUEST_ACTIVE_STATUSES,
  DEAL_REQUEST_LIMITS,
  DEAL_REQUEST_TYPE_LABEL,
  DEAL_TYPE_LABEL,
  DealRequestStatus,
  DealRequestVisibility,
  NotificationType,
  UserStatus,
} from '@house/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { JOB_BATCH_SIZE } from '../constants';
import type { DispatchableNotification } from '../notifications/notification-dispatcher';
import { NotificationsService } from '../notifications/notifications.service';
import {
  DEAL_REQUEST_AGENCIES,
  type DealRequestAgencyDirectory,
} from '../ports/agency-directory.port';

const ENDED_STATUSES = [
  DealRequestStatus.CLOSED,
  DealRequestStatus.CANCELLED,
  DealRequestStatus.EXPIRED,
];

/**
 * Background work of the module (run by DealRequestsProcessor; e2e calls these directly). Every
 * method is idempotent and safe to run concurrently with itself.
 */
@Injectable()
export class DealRequestMaintenanceService {
  private readonly logger = new Logger(DealRequestMaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(DEAL_REQUEST_AGENCIES) private readonly agencies: DealRequestAgencyDirectory,
  ) {}

  /**
   * Notifies every broker who can see a new OPEN request (DEAL_REQUEST_RECEIVED). Serialized per
   * request with an advisory lock; users already notified for it are skipped, so retries and
   * duplicate jobs never notify twice.
   */
  async fanout(dealRequestId: string): Promise<number> {
    const sent = await this.prisma.$transaction(
      async (tx) => {
        const lockKey = `deal-request-fanout:${dealRequestId}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
        const req = await tx.dealRequest.findFirst({
          where: { id: dealRequestId, status: DealRequestStatus.OPEN, deletedAt: null },
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
        if (!req) return [];
        const input = {
          type: NotificationType.DEAL_REQUEST_RECEIVED,
          title: `새 ${DEAL_REQUEST_TYPE_LABEL[req.type]} 요청이 도착했습니다.`,
          body: `${ASSET_TYPE_LABEL[req.assetType]} · ${req.dealTypes.map((d) => DEAL_TYPE_LABEL[d]).join('/')}`,
          data: { dealRequestId: req.id },
        };
        const out: DispatchableNotification[] = [];
        const notify = async (userIds: string[]): Promise<void> => {
          const fresh = await this.notYetNotified(
            tx,
            req.id,
            userIds.filter((u) => u !== req.userId),
          );
          out.push(...(await this.notifications.createFor(fresh, input, tx)));
        };
        if (req.visibility === DealRequestVisibility.SELECTED_AGENCIES) {
          const approved = await this.agencies.approvedIds(
            req.targets.map((t) => t.agencyId),
            tx,
          );
          await notify(await this.agencies.memberUserIds([...approved], tx));
        } else {
          let after: string | null = null;
          do {
            const batch = await this.agencies.regionMemberBatch(req.sggCode, after, tx);
            await notify(batch.userIds);
            after = batch.last;
          } while (after);
        }
        return out;
      },
      { timeout: 60_000 },
    );
    await this.notifications.dispatch(sent);
    return sent.length;
  }

  /** OPEN/MATCHED requests past expiresAt → EXPIRED, with a notice to the requester. */
  async expireDue(now: Date = new Date()): Promise<number> {
    let total = 0;
    for (;;) {
      const sent = await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string; userId: string }[]>`
          UPDATE deal_requests
          SET status = 'EXPIRED'::deal_request_status, closed_at = ${now}, updated_at = ${now}
          WHERE id IN (
            SELECT id FROM deal_requests
            WHERE status IN ('OPEN'::deal_request_status, 'MATCHED'::deal_request_status)
              AND deleted_at IS NULL
              AND expires_at <= ${now}
            ORDER BY expires_at
            LIMIT ${JOB_BATCH_SIZE}
            FOR UPDATE SKIP LOCKED
          )
          RETURNING id, user_id AS "userId"`;
        const notices = await this.notifications.createEach(
          rows.map((r) => ({
            userId: r.userId,
            type: NotificationType.SYSTEM,
            title: '등록하신 요청의 기간이 만료되었습니다.',
            data: { dealRequestId: r.id, status: DealRequestStatus.EXPIRED },
          })),
          tx,
        );
        return { count: rows.length, notices };
      });
      total += sent.count;
      await this.notifications.dispatch(sent.notices);
      if (sent.count < JOB_BATCH_SIZE) break;
    }
    if (total > 0) this.logger.log({ count: total }, 'expired deal requests');
    return total;
  }

  /**
   * Data minimization: erases contact name/phone and 동·호 of requests that ended more than
   * CONTACT_RETENTION_DAYS ago, and of every request of withdrawn members (live ones are cancelled
   * first). Contact grants are revoked with it.
   */
  async scrubDue(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(
      now.getTime() - DEAL_REQUEST_LIMITS.CONTACT_RETENTION_DAYS * 86_400_000,
    );
    let total = 0;
    for (;;) {
      const batch = await this.prisma.dealRequest.findMany({
        where: {
          contactScrubbedAt: null,
          OR: [
            { status: { in: ENDED_STATUSES }, closedAt: { lte: cutoff } },
            { user: { status: UserStatus.WITHDRAWN } },
          ],
        },
        select: { id: true, status: true },
        orderBy: { id: 'asc' },
        take: JOB_BATCH_SIZE,
      });
      if (batch.length === 0) break;
      const ids = batch.map((r) => r.id);
      const live = batch
        .filter((r) => DEAL_REQUEST_ACTIVE_STATUSES.includes(r.status))
        .map((r) => r.id);
      await this.prisma.$transaction(async (tx) => {
        if (live.length > 0) {
          await tx.dealRequest.updateMany({
            where: { id: { in: live }, status: { in: [...DEAL_REQUEST_ACTIVE_STATUSES] } },
            data: { status: DealRequestStatus.CANCELLED, closedAt: now, closeReason: '회원 탈퇴' },
          });
        }
        await tx.dealRequestContactGrant.updateMany({
          where: { dealRequestId: { in: ids }, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.dealRequest.updateMany({
          where: { id: { in: ids }, contactScrubbedAt: null },
          data: { contactName: '', contactPhone: '', addressDetail: null, contactScrubbedAt: now },
        });
      });
      total += ids.length;
      if (batch.length < JOB_BATCH_SIZE) break;
    }
    if (total > 0) this.logger.log({ count: total }, 'scrubbed deal request contacts');
    return total;
  }

  private async notYetNotified(
    tx: PrismaTx,
    dealRequestId: string,
    userIds: string[],
  ): Promise<string[]> {
    if (userIds.length === 0) return [];
    const done = await tx.notification.findMany({
      where: {
        userId: { in: userIds },
        type: NotificationType.DEAL_REQUEST_RECEIVED,
        data: { path: ['dealRequestId'], equals: dealRequestId },
      },
      select: { userId: true },
    });
    const seen = new Set(done.map((d) => d.userId));
    return [...new Set(userIds)].filter((u) => !seen.has(u));
  }
}
