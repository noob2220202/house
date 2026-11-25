import {
  type AdminReportDetailView,
  type AdminReportView,
  AgencyStatus,
  ReportAction,
  ErrorCode,
  isReportActionAllowed,
  isReportOpen,
  NotificationType,
  OPEN_REPORT_STATUSES,
  type Paginated,
  PUBLIC_LISTING_STATUSES,
  REPORT_ACTION_LABEL,
  REPORT_REASON_LABEL,
  reportActionHidesListing,
  reportActionWarnsAgency,
  type ReportCreatedResponse,
  type ReportCreateInput,
  type ReportListQuery,
  type ReportResolveInput,
  type ReportReviewInput,
  ReportStatus,
  ReportTargetType,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../../../common/audit/audit.service';
import type { AdminPrincipal, UserPrincipal } from '../../../common/auth/principal';
import { RequestContext } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { DailyCapService } from '../../../common/throttle/daily-cap.service';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { AgenciesService } from '../../agencies/services/agencies.service';
import { NotificationsService } from '../../deal-requests/notifications/notifications.service';
import {
  reportSelect,
  reportTargetKey,
  toAdminReportView,
  type ReportExtras,
  type ReportRow,
} from '../admin.mapper';
import { REPORT_CONTACT_RETENTION_DAYS } from '../constants';
import { LISTING_MODERATION, type ListingModerationPort } from '../ports/listing-moderation.port';

interface ReportTarget {
  listingId: string | null;
  agencyId: string | null;
}

/**
 * 허위매물 신고: creation by logged-in users (rate limit + daily cap + one open report per
 * user and target) and the back-office workflow RECEIVED → IN_REVIEW → RESOLVED | REJECTED.
 * Resolution can hide the listing (listings module) and/or warn the agency (agencies module).
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly dailyCaps: DailyCapService,
    private readonly agencies: AgenciesService,
    private readonly notifications: NotificationsService,
    @Inject(LISTING_MODERATION) private readonly moderation: ListingModerationPort,
  ) {}

  // ------------------------------------------------------------------ user side

  async create(user: UserPrincipal, dto: ReportCreateInput): Promise<ReportCreatedResponse> {
    const target = await this.resolveTarget(dto.targetType, dto.targetId);
    await this.dailyCaps.consume('REPORT_CREATE', user.userId);
    const ip = RequestContext.current()?.ip?.slice(0, 64) ?? null;
    const report = await this.prisma.$transaction(async (tx) => {
      // One open report per (user, target): serialize concurrent submissions of the same pair.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`report:${user.userId}:${dto.targetId}`}))`;
      const open = await tx.report.findFirst({
        where: {
          reporterUserId: user.userId,
          targetType: dto.targetType,
          ...(dto.targetType === ReportTargetType.LISTING
            ? { listingId: dto.targetId }
            : { agencyId: dto.targetId }),
          status: { in: [...OPEN_REPORT_STATUSES] },
        },
        select: { id: true },
      });
      if (open) throw AppException.conflict(ErrorCode.REPORT_DUPLICATE);
      return tx.report.create({
        data: {
          targetType: dto.targetType,
          listingId: target.listingId,
          agencyId: target.agencyId,
          reporterUserId: user.userId,
          reporterPhone: dto.reporterPhone ?? null,
          reason: dto.reason,
          detail: dto.detail || null,
          ip,
        },
        select: { id: true, status: true, createdAt: true },
      });
    });
    return { id: report.id, status: report.status, createdAt: report.createdAt.toISOString() };
  }

  /** Users can report what they can see: public listings and approved agencies. */
  private async resolveTarget(type: ReportTargetType, id: string): Promise<ReportTarget> {
    if (type === ReportTargetType.LISTING) {
      const listing = await this.prisma.listing.findFirst({
        where: { id, deletedAt: null, status: { in: [...PUBLIC_LISTING_STATUSES] } },
        select: { id: true, primaryAgencyId: true },
      });
      if (!listing) throw AppException.notFound(ErrorCode.REPORT_TARGET_NOT_FOUND);
      return { listingId: listing.id, agencyId: listing.primaryAgencyId };
    }
    const agency = await this.prisma.agency.findFirst({
      where: { id, deletedAt: null, status: AgencyStatus.APPROVED },
      select: { id: true },
    });
    if (!agency) throw AppException.notFound(ErrorCode.REPORT_TARGET_NOT_FOUND);
    return { listingId: null, agencyId: agency.id };
  }

  // ------------------------------------------------------------------ admin side

  async list(q: ReportListQuery): Promise<Paginated<AdminReportView>> {
    const where: Prisma.ReportWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.targetType ? { targetType: q.targetType } : {}),
      ...(q.reason ? { reason: q.reason } : {}),
      ...(q.listingId ? { listingId: q.listingId } : {}),
      ...(q.agencyId ? { agencyId: q.agencyId } : {}),
    };
    const page = await paginate(
      q,
      (args) =>
        this.prisma.report.findMany({
          where,
          select: reportSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
      () => this.prisma.report.count({ where }),
    );
    const extras = await this.extrasFor(page.items);
    return { ...page, items: page.items.map((r) => toAdminReportView(r, { extras })) };
  }

  /**
   * Full view including the reporter's callback number. Viewing it is a 개인정보 접속기록
   * (안전성 확보조치 기준 제8조), so it writes a `report.pii-view` audit row (no PII in the row).
   */
  async detail(id: string): Promise<AdminReportDetailView> {
    const row = await this.load(id);
    if (row.reporterPhone) {
      await this.audit.record({
        action: 'report.pii-view',
        resourceType: 'Report',
        resourceId: id,
        after: { fields: ['reporterPhone'] },
      });
    }
    return this.full(row, { revealContact: true });
  }

  /** Masked view returned by mutations (and therefore stored in their audit rows). */
  private async view(id: string, db: PrismaTx = this.prisma): Promise<AdminReportView> {
    return this.snapshot(await this.load(id, db), db);
  }

  private async snapshot(row: ReportRow, db: PrismaTx = this.prisma): Promise<AdminReportView> {
    return toAdminReportView(row, { extras: await this.extrasFor([row], db) });
  }

  /**
   * The detail: the view + other reports against the same target and the handling timeline
   * (접수 + `report.review` / `report.resolve` audit rows). `pending` is the change being answered
   * when its audit row is written only after the response (PATCH).
   */
  private async full(
    row: ReportRow,
    opts: {
      revealContact?: boolean;
      pending?: { status: ReportStatus | null; note: string | null; at: Date };
    } = {},
  ): Promise<AdminReportDetailView> {
    const key = reportTargetKey(row);
    const [extras, related, audits] = await Promise.all([
      this.extrasFor([row]),
      key
        ? this.prisma.report.findMany({
            where: {
              id: { not: row.id },
              ...(row.targetType === ReportTargetType.LISTING
                ? { targetType: row.targetType, listingId: row.listingId }
                : { targetType: row.targetType, agencyId: row.agencyId }),
            },
            select: { id: true, reason: true, status: true, action: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
          })
        : [],
      this.prisma.auditLog.findMany({
        where: {
          resourceType: 'Report',
          resourceId: row.id,
          action: { in: ['report.review', 'report.resolve'] },
        },
        select: {
          id: true,
          action: true,
          before: true,
          after: true,
          createdAt: true,
          adminUser: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    const field = (v: Prisma.JsonValue | null, k: string): string | null => {
      const o = v && typeof v === 'object' && !Array.isArray(v) ? v : null;
      const x = o?.[k];
      return typeof x === 'string' ? x : null;
    };
    const timeline: AdminReportDetailView['timeline'] = audits.map((a) => {
      const status = field(a.after, 'status') as ReportStatus | null;
      const note = field(a.after, 'resolutionNote');
      const statusChanged = a.action === 'report.resolve' || status !== field(a.before, 'status');
      const noteChanged =
        a.action === 'report.resolve' || note !== field(a.before, 'resolutionNote');
      return {
        id: a.id,
        status: statusChanged ? status : null,
        note: noteChanged ? note : null,
        adminName: a.adminUser?.name ?? null,
        createdAt: a.createdAt.toISOString(),
      };
    });
    if (opts.pending)
      timeline.unshift({
        id: `pending:${row.id}`,
        status: opts.pending.status,
        note: opts.pending.note,
        adminName: row.handledBy?.name ?? null,
        createdAt: opts.pending.at.toISOString(),
      });
    timeline.push({
      id: `received:${row.id}`,
      status: ReportStatus.RECEIVED,
      note: null,
      adminName: null,
      createdAt: row.createdAt.toISOString(),
    });
    return {
      ...toAdminReportView(row, { revealContact: opts.revealContact, extras }),
      relatedReports: related.map((r) => ({
        id: r.id,
        reason: r.reason,
        status: r.status,
        action: r.action,
        createdAt: r.createdAt.toISOString(),
      })),
      timeline,
    };
  }

  /** Reporter totals and same-target counts for a page of reports (at most four queries). */
  private async extrasFor(
    rows: readonly ReportRow[],
    db: PrismaTx = this.prisma,
  ): Promise<ReportExtras> {
    const reporterIds = [...new Set(rows.flatMap((r) => (r.reporter ? [r.reporter.id] : [])))];
    const listingIds = [
      ...new Set(
        rows.flatMap((r) =>
          r.targetType === ReportTargetType.LISTING && r.listingId ? [r.listingId] : [],
        ),
      ),
    ];
    const agencyIds = [
      ...new Set(
        rows.flatMap((r) =>
          r.targetType === ReportTargetType.AGENCY && r.agencyId ? [r.agencyId] : [],
        ),
      ),
    ];
    const [filed, upheld, byListing, byAgency] = await Promise.all([
      reporterIds.length
        ? db.report.groupBy({
            by: ['reporterUserId'],
            where: { reporterUserId: { in: reporterIds } },
            _count: { _all: true },
          })
        : [],
      reporterIds.length
        ? db.report.groupBy({
            by: ['reporterUserId'],
            where: {
              reporterUserId: { in: reporterIds },
              status: ReportStatus.RESOLVED,
              action: { not: ReportAction.NONE },
            },
            _count: { _all: true },
          })
        : [],
      listingIds.length
        ? db.report.groupBy({
            by: ['listingId'],
            where: { targetType: ReportTargetType.LISTING, listingId: { in: listingIds } },
            _count: { _all: true },
          })
        : [],
      agencyIds.length
        ? db.report.groupBy({
            by: ['agencyId'],
            where: { targetType: ReportTargetType.AGENCY, agencyId: { in: agencyIds } },
            _count: { _all: true },
          })
        : [],
    ]);
    const upheldOf = new Map(upheld.map((u) => [u.reporterUserId, u._count._all]));
    return {
      reporterStats: new Map(
        filed.flatMap((f) =>
          f.reporterUserId
            ? [
                [
                  f.reporterUserId,
                  { reportCount: f._count._all, upheldCount: upheldOf.get(f.reporterUserId) ?? 0 },
                ] as const,
              ]
            : [],
        ),
      ),
      sameTarget: new Map([
        ...byListing.flatMap((g) =>
          g.listingId ? [[`L:${g.listingId}`, g._count._all] as const] : [],
        ),
        ...byAgency.flatMap((g) =>
          g.agencyId ? [[`A:${g.agencyId}`, g._count._all] as const] : [],
        ),
      ]),
    };
  }

  /**
   * Retention of the reporter's contact data: once a report has been closed for
   * REPORT_CONTACT_RETENTION_DAYS, its callback number and source ip have served their purpose
   * and are erased (withdrawn reporters are scrubbed earlier by the auth module's PiiScrubService).
   * Idempotent; returns the number of reports scrubbed.
   */
  async scrubExpiredContacts(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - REPORT_CONTACT_RETENTION_DAYS * 86_400_000);
    const { count } = await this.prisma.report.updateMany({
      where: {
        status: { notIn: [...OPEN_REPORT_STATUSES] },
        handledAt: { lt: cutoff },
        OR: [{ reporterPhone: { not: null } }, { ip: { not: null } }],
      },
      data: { reporterPhone: null, ip: null },
    });
    return count;
  }

  /** Takes the report into review and/or records an internal note. */
  async review(
    id: string,
    dto: ReportReviewInput,
    admin: AdminPrincipal,
  ): Promise<AdminReportDetailView> {
    const before = await this.load(id);
    if (!isReportOpen(before.status)) throw AppException.conflict(ErrorCode.REPORT_ALREADY_HANDLED);
    RequestContext.setAuditBefore(await this.snapshot(before));
    const { count } = await this.prisma.report.updateMany({
      where: { id, status: { in: [...OPEN_REPORT_STATUSES] } },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.note !== undefined ? { resolutionNote: dto.note || null } : {}),
        handledByAdminId: admin.adminId,
      },
    });
    if (count === 0) throw AppException.conflict(ErrorCode.REPORT_ALREADY_HANDLED);
    const after = await this.load(id);
    return this.full(after, {
      pending: {
        status: dto.status && dto.status !== before.status ? dto.status : null,
        note:
          dto.note !== undefined && (dto.note || null) !== before.resolutionNote
            ? dto.note || null
            : null,
        at: new Date(),
      },
    });
  }

  async resolve(
    id: string,
    dto: ReportResolveInput,
    admin: AdminPrincipal,
  ): Promise<AdminReportDetailView> {
    const before = await this.load(id);
    if (!isReportOpen(before.status)) throw AppException.conflict(ErrorCode.REPORT_ALREADY_HANDLED);
    const hideListing =
      dto.status === ReportStatus.RESOLVED && reportActionHidesListing(dto.action);
    const warnAgency = dto.status === ReportStatus.RESOLVED && reportActionWarnsAgency(dto.action);
    if (
      !isReportActionAllowed(before.targetType, dto.status, dto.action) ||
      (hideListing && (!before.listing || before.listing.deletedAt)) ||
      (warnAgency && !before.agencyId)
    ) {
      throw AppException.badRequest(ErrorCode.REPORT_ACTION_INVALID, {
        targetType: before.targetType,
        action: dto.action,
      });
    }

    const listingId = before.listingId;
    const notifications = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.report.updateMany({
        where: { id, status: { in: [...OPEN_REPORT_STATUSES] } },
        data: {
          status: dto.status,
          action: dto.action,
          resolutionNote: dto.note ?? before.resolutionNote,
          handledByAdminId: admin.adminId,
          handledAt: new Date(),
        },
      });
      if (count === 0) throw AppException.conflict(ErrorCode.REPORT_ALREADY_HANDLED);

      // Only the admin who claimed the report above gets here, so a concurrent REJECTED decision
      // can never leave the listing hidden.
      if (hideListing && listingId) {
        await this.moderation.hide(
          listingId,
          `허위매물 신고 처리: ${REPORT_REASON_LABEL[before.reason]}`,
          tx,
        );
      }

      if (warnAgency && before.agencyId) {
        await this.agencies.recordWarning(
          {
            agencyId: before.agencyId,
            reason:
              `허위매물 신고 처리: ${REPORT_REASON_LABEL[before.reason]}${dto.note ? ` — ${dto.note}` : ''}`.slice(
                0,
                1000,
              ),
            reportId: id,
            adminId: admin.adminId,
          },
          tx,
        );
      }
      const rows = await this.notify(tx, before, dto, hideListing);
      const after = await this.view(id, tx);
      await this.audit.record(
        {
          action: 'report.resolve',
          resourceType: 'Report',
          resourceId: id,
          before: await this.snapshot(before, tx),
          after,
        },
        tx,
      );
      return rows;
    });
    if (hideListing) await this.moderation.invalidateSearch();
    await this.notifications.dispatch(notifications);
    return this.full(await this.load(id));
  }

  private async notify(
    tx: PrismaTx,
    report: ReportRow,
    dto: ReportResolveInput,
    hideListing: boolean,
  ) {
    const rows = [];
    if (report.reporterUserId) {
      rows.push(
        ...(await this.notifications.createFor(
          [report.reporterUserId],
          {
            type: NotificationType.REPORT_RESOLVED,
            title:
              dto.status === ReportStatus.RESOLVED
                ? '신고하신 내용이 처리되었습니다.'
                : '신고하신 내용을 검토한 결과 조치하지 않기로 했습니다.',
            body: dto.status === ReportStatus.RESOLVED ? REPORT_ACTION_LABEL[dto.action] : null,
            data: { reportId: report.id },
          },
          tx,
        )),
      );
    }
    if (hideListing && report.listingId && report.agencyId) {
      const agency = await tx.agency.findUnique({
        where: { id: report.agencyId },
        select: { ownerUserId: true },
      });
      if (agency) {
        rows.push(
          ...(await this.notifications.createFor(
            [agency.ownerUserId],
            {
              type: NotificationType.LISTING_HIDDEN,
              title: '허위매물 신고로 매물이 숨김 처리되었습니다.',
              body: REPORT_REASON_LABEL[report.reason],
              data: { listingId: report.listingId, reportId: report.id },
            },
            tx,
          )),
        );
      }
    }
    return rows;
  }

  private async load(id: string, db: PrismaTx = this.prisma): Promise<ReportRow> {
    const row = await db.report.findUnique({ where: { id }, select: reportSelect });
    if (!row) throw AppException.notFound(ErrorCode.REPORT_NOT_FOUND);
    return row;
  }
}
