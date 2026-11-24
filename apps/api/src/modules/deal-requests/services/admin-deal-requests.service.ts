import {
  DealRequestStatus,
  ErrorCode,
  NotificationType,
  type AdminDealRequestCloseInput,
  type Paginated,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RequestContext } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { DealRequestMapper, type AdminDealRequestModerationView } from '../deal-request.mapper';
import { dealRequestAdminSelect, type DealRequestAdminRow } from '../deal-request.selects';
import type { AdminDealRequestListQueryWithSpam, AdminDealRequestSpamFlagInput } from '../dto';
import { NotificationsService } from '../notifications/notifications.service';
import { DealRequestLifecycleService } from './deal-request-lifecycle.service';

/**
 * Back-office moderation of 내놓기/구하기. Admins see the requester id and a masked contact only;
 * closing a request revokes every contact grant and notifies requester + proposing agencies.
 * Flagging a request as spam hides it from every agency (deal-request-access) until cleared; the
 * requester is not told and nothing else about the request changes.
 */
@Injectable()
export class AdminDealRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: DealRequestMapper,
    private readonly notifications: NotificationsService,
    private readonly lifecycle: DealRequestLifecycleService,
  ) {}

  async list(
    q: AdminDealRequestListQueryWithSpam,
  ): Promise<Paginated<AdminDealRequestModerationView>> {
    const where: Prisma.DealRequestWhereInput = {
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
    const page = await paginate(
      q,
      (args) =>
        this.prisma.dealRequest.findMany({
          where,
          select: dealRequestAdminSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
      () => this.prisma.dealRequest.count({ where }),
    );
    return { ...page, items: page.items.map((r) => this.mapper.admin(r)) };
  }

  async get(id: string): Promise<AdminDealRequestModerationView> {
    return this.mapper.admin(await this.load(id));
  }

  async close(
    id: string,
    input: AdminDealRequestCloseInput,
    now: Date = new Date(),
  ): Promise<AdminDealRequestModerationView> {
    const before = await this.load(id);
    RequestContext.setAuditBefore(this.mapper.admin(before));
    const sent = await this.prisma.$transaction(async (tx) => {
      const agencyRows = await this.lifecycle.end(tx, {
        dealRequestId: id,
        to: DealRequestStatus.CLOSED,
        reason: input.reason,
        revokeGrants: true,
        now,
      });
      const ownerRows = await this.notifications.createFor(
        [before.userId],
        {
          type: NotificationType.SYSTEM,
          title: '운영 정책에 따라 요청이 종료되었습니다.',
          body: input.reason,
          data: { dealRequestId: id },
        },
        tx,
      );
      return [...agencyRows, ...ownerRows];
    });
    await this.notifications.dispatch(sent);
    return this.get(id);
  }

  /**
   * Sets or clears the spam flag. Re-flagging a flagged request only replaces the reason (and the
   * admin) and keeps the original flag time; clearing an unflagged one is a no-op.
   */
  async setSpamFlag(
    id: string,
    input: AdminDealRequestSpamFlagInput,
    adminId: string,
    now: Date = new Date(),
  ): Promise<AdminDealRequestModerationView> {
    const before = await this.load(id);
    RequestContext.setAuditBefore(this.mapper.admin(before));
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

  private async load(id: string): Promise<DealRequestAdminRow> {
    const row = await this.prisma.dealRequest.findUnique({
      where: { id },
      select: dealRequestAdminSelect,
    });
    if (!row) throw AppException.notFound(ErrorCode.DEAL_REQUEST_NOT_FOUND);
    return row;
  }
}
