import {
  DEAL_REQUEST_ACTIVE_STATUSES,
  DEAL_REQUEST_STATUS_LABEL,
  DealRequestStatus,
  ErrorCode,
  NotificationType,
  ProposalStatus,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import type { PrismaTx } from '../../../prisma/prisma.service';
import type { DispatchableNotification } from '../notifications/notification-dispatcher';
import { NotificationsService } from '../notifications/notifications.service';
import {
  DEAL_REQUEST_AGENCIES,
  type DealRequestAgencyDirectory,
} from '../ports/agency-directory.port';

export type EndStatus = typeof DealRequestStatus.CLOSED | typeof DealRequestStatus.CANCELLED;

export interface EndRequestInput {
  dealRequestId: string;
  to: EndStatus;
  reason?: string | null;
  /** Revoke every contact grant (cancel / moderation). Completion keeps them. */
  revokeGrants: boolean;
  /** Exclude from agency notifications (the acting requester, if also a broker). */
  actorUserId?: string;
  now: Date;
}

/** State transitions shared by the requester and admin flows. */
@Injectable()
export class DealRequestLifecycleService {
  constructor(
    private readonly notifications: NotificationsService,
    @Inject(DEAL_REQUEST_AGENCIES) private readonly agencies: DealRequestAgencyDirectory,
  ) {}

  /**
   * OPEN/MATCHED → CLOSED/CANCELLED inside `tx` (conditional update, so concurrent transitions
   * cannot both win) and notifies agencies with live proposals. Returns rows to dispatch after commit.
   */
  async end(tx: PrismaTx, input: EndRequestInput): Promise<DispatchableNotification[]> {
    const { dealRequestId: id, now } = input;
    const { count } = await tx.dealRequest.updateMany({
      where: { id, status: { in: [...DEAL_REQUEST_ACTIVE_STATUSES] }, deletedAt: null },
      data: { status: input.to, closedAt: now, closeReason: input.reason ?? null },
    });
    if (count === 0) throw AppException.badRequest(ErrorCode.DEAL_REQUEST_STATE_INVALID);
    if (input.revokeGrants) {
      await tx.dealRequestContactGrant.updateMany({
        where: { dealRequestId: id, revokedAt: null },
        data: { revokedAt: now },
      });
    }
    const proposals = await tx.proposal.findMany({
      where: {
        dealRequestId: id,
        status: { in: [ProposalStatus.SENT, ProposalStatus.VIEWED, ProposalStatus.ACCEPTED] },
      },
      select: { agencyId: true },
    });
    const recipients = (
      await this.agencies.memberRecipients(
        proposals.map((p) => p.agencyId),
        tx,
      )
    ).filter((r) => r.userId !== input.actorUserId);
    return this.notifications.createForMembers(
      recipients,
      {
        type: NotificationType.SYSTEM,
        title: `제안하신 요청이 ${DEAL_REQUEST_STATUS_LABEL[input.to]} 처리되었습니다.`,
        data: { dealRequestId: id, status: input.to },
      },
      tx,
    );
  }

  /** Creates or re-activates a contact grant. Returns false when it was already active. */
  async grant(tx: PrismaTx, dealRequestId: string, agencyId: string, now: Date): Promise<boolean> {
    const existing = await tx.dealRequestContactGrant.findUnique({
      where: { dealRequestId_agencyId: { dealRequestId, agencyId } },
      select: { revokedAt: true },
    });
    if (existing && existing.revokedAt === null) return false;
    await tx.dealRequestContactGrant.upsert({
      where: { dealRequestId_agencyId: { dealRequestId, agencyId } },
      create: { dealRequestId, agencyId, grantedAt: now },
      update: { grantedAt: now, revokedAt: null },
    });
    return true;
  }
}
