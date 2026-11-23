import {
  DealRequestStatus,
  ErrorCode,
  NotificationType,
  type AdminDealRequestCloseInput,
  type AdminDealRequestListQuery,
  type AdminDealRequestView,
  type Paginated,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RequestContext } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { DealRequestMapper } from '../deal-request.mapper';
import { dealRequestAdminSelect, type DealRequestAdminRow } from '../deal-request.selects';
import { NotificationsService } from '../notifications/notifications.service';
import { DealRequestLifecycleService } from './deal-request-lifecycle.service';

/**
 * Back-office moderation of 내놓기/구하기. Admins see the requester id and a masked contact only;
 * closing a request revokes every contact grant and notifies requester + proposing agencies.
 */
@Injectable()
export class AdminDealRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: DealRequestMapper,
    private readonly notifications: NotificationsService,
    private readonly lifecycle: DealRequestLifecycleService,
  ) {}

  async list(q: AdminDealRequestListQuery): Promise<Paginated<AdminDealRequestView>> {
    const where: Prisma.DealRequestWhereInput = {
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

  async get(id: string): Promise<AdminDealRequestView> {
    return this.mapper.admin(await this.load(id));
  }

  async close(
    id: string,
    input: AdminDealRequestCloseInput,
    now: Date = new Date(),
  ): Promise<AdminDealRequestView> {
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

  private async load(id: string): Promise<DealRequestAdminRow> {
    const row = await this.prisma.dealRequest.findUnique({
      where: { id },
      select: dealRequestAdminSelect,
    });
    if (!row) throw AppException.notFound(ErrorCode.DEAL_REQUEST_NOT_FOUND);
    return row;
  }
}
