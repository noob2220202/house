import {
  DealRequestStatus,
  ErrorCode,
  NotificationType,
  UserStatus,
  type AdminDealRequestRequesterView,
  type AdminDealRequestCloseInput,
  type Paginated,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RequestContext } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DealRequestMapper,
  type AdminDealRequestExtras,
  type AdminDealRequestModerationDetailView,
  type AdminDealRequestModerationView,
  type DealRequestAuditRow,
} from '../deal-request.mapper';
import {
  dealRequestAdminDetailSelect,
  dealRequestAdminSelect,
  type DealRequestAdminRow,
} from '../deal-request.selects';
import type { AdminDealRequestListQueryWithSpam, AdminDealRequestSpamFlagInput } from '../dto';
import { NotificationsService } from '../notifications/notifications.service';
import { DealRequestLifecycleService } from './deal-request-lifecycle.service';
import { RegionNamesService } from './region-names.service';

/** Audit actions (AdminDealRequestsController) that appear in a request's history. */
const HISTORY_AUDIT_ACTIONS = ['dealRequest.close', 'dealRequest.spamFlag'];

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
    private readonly regionNames: RegionNamesService,
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
      ...(q.q
        ? {
            AND: [
              {
                OR: [
                  { complex: { name: { contains: q.q, mode: 'insensitive' } } },
                  { roadAddress: { contains: q.q, mode: 'insensitive' } },
                  { description: { contains: q.q, mode: 'insensitive' } },
                  {
                    user: {
                      nickname: { contains: q.q, mode: 'insensitive' },
                      status: { not: UserStatus.WITHDRAWN },
                    },
                  },
                ],
              },
            ],
          }
        : {}),
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
    const extras = await this.extrasFor(page.items);
    return { ...page, items: page.items.map((r, i) => this.mapper.admin(r, extras[i]!)) };
  }

  /**
   * `pending` is the audit row of the action being answered: the audit interceptor writes it only
   * after the response is built, so a close / spam-flag response would otherwise miss its own line.
   */
  async get(
    id: string,
    pending?: DealRequestAuditRow,
  ): Promise<AdminDealRequestModerationDetailView> {
    const row = await this.prisma.dealRequest.findUnique({
      where: { id },
      select: dealRequestAdminDetailSelect,
    });
    if (!row) throw AppException.notFound(ErrorCode.DEAL_REQUEST_NOT_FOUND);
    const [[extras], audits] = await Promise.all([
      this.extrasFor([row]),
      this.prisma.auditLog.findMany({
        where: {
          resourceType: 'DealRequest',
          resourceId: id,
          action: { in: HISTORY_AUDIT_ACTIONS },
        },
        select: {
          id: true,
          action: true,
          after: true,
          createdAt: true,
          adminUser: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    return this.mapper.adminDetail(row, extras!, pending ? [pending, ...audits] : audits);
  }

  async close(
    id: string,
    input: AdminDealRequestCloseInput,
    now: Date = new Date(),
  ): Promise<AdminDealRequestModerationDetailView> {
    const before = await this.load(id);
    RequestContext.setAuditBefore(await this.auditView(before));
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
    return this.get(id, {
      id: `pending:close:${id}`,
      action: 'dealRequest.close',
      after: { closeReason: input.reason },
      createdAt: now,
      adminUser: null,
    });
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
  ): Promise<AdminDealRequestModerationDetailView> {
    const before = await this.load(id);
    RequestContext.setAuditBefore(await this.auditView(before));
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
    return this.get(id, {
      id: `pending:spam:${id}`,
      action: 'dealRequest.spamFlag',
      after: input.flagged
        ? { spamFlaggedAt: now.toISOString(), spamReason: input.reason ?? null }
        : { spamFlaggedAt: null },
      createdAt: now,
      adminUser: null,
    });
  }

  private async auditView(row: DealRequestAdminRow): Promise<AdminDealRequestModerationView> {
    const [extras] = await this.extrasFor([row]);
    return this.mapper.admin(row, extras!);
  }

  /**
   * Requester summary + region names for a page of rows, in three queries whatever the page size
   * (users, per-user request counts, region names). A withdrawn member reads `WITHDRAWN` with no
   * nickname even before the PII scrub; a scrubbed row has none anyway.
   */
  private async extrasFor(
    rows: readonly Pick<DealRequestAdminRow, 'userId' | 'emdCode' | 'regionCodes'>[],
  ): Promise<AdminDealRequestExtras[]> {
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const [users, counts, regionNames] = await Promise.all([
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              nickname: true,
              status: true,
              createdAt: true,
              piiScrubbedAt: true,
            },
          })
        : [],
      userIds.length
        ? this.prisma.dealRequest.groupBy({
            by: ['userId'],
            where: { userId: { in: userIds } },
            _count: { _all: true },
          })
        : [],
      this.regionNames.namesOf(rows.flatMap((r) => [r.emdCode, ...r.regionCodes])),
    ]);
    const countOf = new Map(counts.map((c) => [c.userId, c._count._all]));
    const requesters = new Map<string, AdminDealRequestRequesterView>(
      users.map((u) => {
        const gone = u.status === UserStatus.WITHDRAWN || u.piiScrubbedAt !== null;
        return [
          u.id,
          {
            id: u.id,
            nickname: gone ? null : u.nickname,
            status: gone ? UserStatus.WITHDRAWN : u.status,
            createdAt: u.createdAt.toISOString(),
            dealRequestCount: countOf.get(u.id) ?? 0,
          },
        ];
      }),
    );
    return rows.map((r) => ({ requester: requesters.get(r.userId) ?? null, regionNames }));
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
