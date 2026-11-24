import {
  ASSET_TYPE_LABEL,
  DEAL_REQUEST_LIMITS,
  DEAL_REQUEST_STATUS_LABEL,
  DEAL_REQUEST_TYPE_LABEL,
  DEAL_TYPE_LABEL,
  DealRequestStatus,
  DealRequestVisibility,
  NotificationType,
  ProposalStatus,
  UserStatus,
} from '@house/shared';
import type { Prisma } from '@prisma/client';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { JOB_BATCH_SIZE } from '../constants';
import type { DispatchableNotification } from '../notifications/notification-dispatcher';
import { NotificationsService, type MemberRecipient } from '../notifications/notifications.service';
import {
  DEAL_REQUEST_AGENCIES,
  type DealRequestAgencyDirectory,
} from '../ports/agency-directory.port';
import { DEAL_REQUEST_MEDIA, type DealRequestMediaPort } from '../ports/media.port';

const ENDED_STATUSES = [
  DealRequestStatus.CLOSED,
  DealRequestStatus.CANCELLED,
  DealRequestStatus.EXPIRED,
];

const WITHDRAWAL_REASON = '회원 탈퇴';

/** Requests that still hold anything identifying (contact, 동·호, address, position, …, photos). */
const IDENTIFYING_RESIDUE: Prisma.DealRequestWhereInput = {
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

/** Withdrawn members' requests that still hold anything identifying. */
const WITHDRAWN_RESIDUE: Prisma.DealRequestWhereInput = {
  user: { status: UserStatus.WITHDRAWN },
  ...IDENTIFYING_RESIDUE,
};

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
    @Inject(DEAL_REQUEST_MEDIA) private readonly media: DealRequestMediaPort,
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
          // A request flagged as spam before the job ran reaches nobody.
          where: {
            id: dealRequestId,
            status: DealRequestStatus.OPEN,
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
        if (!req) return [];
        const input = {
          type: NotificationType.DEAL_REQUEST_RECEIVED,
          title: `새 ${DEAL_REQUEST_TYPE_LABEL[req.type]} 요청이 도착했습니다.`,
          body: `${ASSET_TYPE_LABEL[req.assetType]} · ${req.dealTypes.map((d) => DEAL_TYPE_LABEL[d]).join('/')}`,
          data: { dealRequestId: req.id },
        };
        const out: DispatchableNotification[] = [];
        const notify = async (recipients: MemberRecipient[]): Promise<void> => {
          const fresh = new Set(
            await this.notYetNotified(
              tx,
              req.id,
              recipients.map((r) => r.userId).filter((u) => u !== req.userId),
            ),
          );
          out.push(
            ...(await this.notifications.createForMembers(
              recipients.filter((r) => fresh.has(r.userId)),
              input,
              tx,
            )),
          );
        };
        if (req.visibility === DealRequestVisibility.SELECTED_AGENCIES) {
          const approved = await this.agencies.approvedIds(
            req.targets.map((t) => t.agencyId),
            tx,
          );
          await notify(await this.agencies.memberRecipients([...approved], tx));
        } else {
          let after: string | null = null;
          do {
            const batch = await this.agencies.regionMemberBatch(req.sggCode, after, tx);
            await notify(batch.recipients);
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

  /**
   * OPEN requests past expiresAt → EXPIRED, with a notice to the requester. MATCHED requests never
   * expire: an agency is mid-deal with the requester, who ends the request by closing or cancelling
   * it. Expired requests can be reopened with POST /me/deal-requests/:id/extend.
   */
  async expireDue(now: Date = new Date()): Promise<number> {
    let total = 0;
    for (;;) {
      const sent = await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string; userId: string }[]>`
          UPDATE deal_requests
          SET status = 'EXPIRED'::deal_request_status, closed_at = ${now}, updated_at = ${now}
          WHERE id IN (
            SELECT id FROM deal_requests
            WHERE status = 'OPEN'::deal_request_status
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
            body: '요청 상세에서 기간을 연장하면 다시 진행할 수 있습니다.',
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
   * Data minimization (파기, 개인정보 보호법 제21조), two passes:
   *  - requests that ended (CLOSED / CANCELLED / EXPIRED) at least CONTACT_RETENTION_DAYS (30) ago
   *    lose everything identifying — contact name/phone, 동·호, road address, position, floor,
   *    area, description and photos (media soft-deleted) — and their contact grants. What stays is
   *    the request record: type, asset/deal type, prices, 읍면동 / 단지, wanted conditions, dates;
   *  - requests of withdrawn members are cancelled (agencies told) and erased the same way.
   *    AccountService.withdraw does this at once via scrubUser; this pass is the safety net.
   * Selection is by residue, not by a marker, so a run picks up anything an earlier policy or an
   * interrupted run left behind; re-running finds nothing (idempotent).
   */
  async scrubDue(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(
      now.getTime() - DEAL_REQUEST_LIMITS.CONTACT_RETENTION_DAYS * 86_400_000,
    );
    let total = 0;
    for (;;) {
      const batch = await this.prisma.dealRequest.findMany({
        where: {
          status: { in: ENDED_STATUSES },
          closedAt: { lte: cutoff },
          user: { status: { not: UserStatus.WITHDRAWN } },
          ...IDENTIFYING_RESIDUE,
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: JOB_BATCH_SIZE,
      });
      if (batch.length === 0) break;
      const ids = batch.map((r) => r.id);
      await this.prisma.$transaction(async (tx) => {
        // Re-check under the row lock: a request reopened (extend) since the read is left alone.
        const due = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM deal_requests
          WHERE id = ANY(${ids}::uuid[])
            AND status IN ('CLOSED'::deal_request_status, 'CANCELLED'::deal_request_status,
                           'EXPIRED'::deal_request_status)
            AND closed_at <= ${cutoff}
          FOR UPDATE`;
        await this.erase(
          tx,
          due.map((r) => r.id),
          now,
        );
      });
      total += ids.length;
      if (batch.length < JOB_BATCH_SIZE) break;
    }
    for (;;) {
      const batch = await this.prisma.dealRequest.findMany({
        where: WITHDRAWN_RESIDUE,
        select: { id: true },
        orderBy: { id: 'asc' },
        take: JOB_BATCH_SIZE,
      });
      if (batch.length === 0) break;
      const ids = batch.map((r) => r.id);
      const notices = await this.prisma.$transaction((tx) => this.eraseWithdrawn(tx, ids, now));
      await this.notifications.dispatch(notices);
      total += ids.length;
      if (batch.length < JOB_BATCH_SIZE) break;
    }
    if (total > 0) this.logger.log({ count: total }, 'erased ended / withdrawn deal requests');
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
  async scrubUser(
    userId: string,
    now: Date = new Date(),
    tx?: PrismaTx,
  ): Promise<DispatchableNotification[]> {
    const run = async (db: PrismaTx): Promise<DispatchableNotification[]> => {
      const rows = await db.dealRequest.findMany({ where: { userId }, select: { id: true } });
      return this.eraseWithdrawn(
        db,
        rows.map((r) => r.id),
        now,
      );
    };
    if (tx) return run(tx);
    const notices = await this.prisma.$transaction(run);
    await this.notifications.dispatch(notices);
    return notices;
  }

  /** Best-effort delivery of notices returned by `scrubUser(…, tx)` once its transaction commits. */
  dispatch(notices: readonly DispatchableNotification[]): Promise<void> {
    return this.notifications.dispatch(notices);
  }

  private async eraseWithdrawn(
    tx: PrismaTx,
    ids: readonly string[],
    now: Date,
  ): Promise<DispatchableNotification[]> {
    if (ids.length === 0) return [];
    const cancelled = await tx.$queryRaw<{ id: string }[]>`
      UPDATE deal_requests
      SET status = 'CANCELLED'::deal_request_status, closed_at = ${now},
          close_reason = ${WITHDRAWAL_REASON}, updated_at = ${now}
      WHERE id = ANY(${[...ids]}::uuid[])
        AND status IN ('OPEN'::deal_request_status, 'MATCHED'::deal_request_status)
      RETURNING id`;
    const notices = await this.notifyCancelled(
      tx,
      cancelled.map((r) => r.id),
    );
    await this.erase(tx, ids, now);
    return notices;
  }

  /**
   * Revokes the grants and erases contact, 동·호, address, position, floor, area, description and
   * photos. `contactScrubbedAt` keeps the first erasure time.
   */
  private async erase(tx: PrismaTx, ids: readonly string[], now: Date): Promise<void> {
    if (ids.length === 0) return;
    await this.revokeGrants(tx, ids, now);
    await this.media.discardPhotos(ids, now, tx);
    // lat/lng → NULL also clears `location` (deal_requests_sync_location trigger).
    const erased = {
      contactName: '',
      contactPhone: '',
      addressDetail: null,
      roadAddress: null,
      lat: null,
      lng: null,
      floor: null,
      exclusiveArea: null,
      description: null,
    };
    await tx.dealRequest.updateMany({
      where: { id: { in: [...ids] }, contactScrubbedAt: null },
      data: { ...erased, contactScrubbedAt: now },
    });
    await tx.dealRequest.updateMany({
      where: { id: { in: [...ids] }, contactScrubbedAt: { not: null } },
      data: erased,
    });
  }

  /** Same notice as DealRequestLifecycleService.end, for agencies with live proposals. */
  private async notifyCancelled(
    tx: PrismaTx,
    ids: readonly string[],
  ): Promise<DispatchableNotification[]> {
    if (ids.length === 0) return [];
    const proposals = await tx.proposal.findMany({
      where: {
        dealRequestId: { in: [...ids] },
        status: { in: [ProposalStatus.SENT, ProposalStatus.VIEWED, ProposalStatus.ACCEPTED] },
      },
      select: { dealRequestId: true, agencyId: true },
    });
    const byRequest = new Map<string, string[]>();
    for (const p of proposals) {
      byRequest.set(p.dealRequestId, [...(byRequest.get(p.dealRequestId) ?? []), p.agencyId]);
    }
    const out: DispatchableNotification[] = [];
    for (const [dealRequestId, agencyIds] of byRequest) {
      const recipients = await this.agencies.memberRecipients(agencyIds, tx);
      out.push(
        ...(await this.notifications.createForMembers(
          recipients,
          {
            type: NotificationType.SYSTEM,
            title: `제안하신 요청이 ${DEAL_REQUEST_STATUS_LABEL[DealRequestStatus.CANCELLED]} 처리되었습니다.`,
            body: '요청자가 탈퇴하여 요청이 종료되었습니다.',
            data: { dealRequestId, status: DealRequestStatus.CANCELLED },
          },
          tx,
        )),
      );
    }
    return out;
  }

  private async revokeGrants(tx: PrismaTx, ids: readonly string[], now: Date): Promise<void> {
    await tx.dealRequestContactGrant.updateMany({
      where: { dealRequestId: { in: [...ids] }, revokedAt: null },
      data: { revokedAt: now },
    });
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
