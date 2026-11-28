import {
  AgencySubscriptionState,
  ErrorCode,
  SubscriptionProduct,
  kstDate,
  type AdminSubscriptionCreateInput,
  type AdminSubscriptionUpdateInput,
  type AgencySubscriptionView,
  type AgencySubscriptionsResponse,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { AuditService } from '../../../common/audit/audit.service';
import { AppException } from '../../../common/errors/app.exception';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { agencySubscriptionSelect, type AgencySubscriptionRow } from '../agency-site.selects';
import { lockAgency } from '../domain/locks';
import { dateOnly, toDbDate, toSubscriptionView } from '../domain/sites';
import { AgencyCacheService } from './agency-cache.service';

/** Audit snapshot of a period (amount and memo are business data, not PII). */
function snapshot(row: AgencySubscriptionRow): Record<string, unknown> {
  return {
    agencyId: row.agencyId,
    product: row.product,
    startsOn: dateOnly(row.startsOn),
    endsOn: row.endsOn ? dateOnly(row.endsOn) : null,
    amountWon: row.amountWon,
    memo: row.memo,
    canceledAt: row.canceledAt?.toISOString() ?? null,
  };
}

/**
 * 이용권 (사무소 홈페이지 / 메인 사이트 입점) periods an admin records after an offline payment
 * (bank transfer). Nothing is charged here. A SITE period matters only while
 * FEATURES.siteSubscriptionRequired is on (AgencySiteGateService); PLATFORM is recorded and
 * shown but not enforced yet.
 */
@Injectable()
export class AgencySubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AgencyCacheService,
    private readonly audit: AuditService,
  ) {}

  /** Newest period first, with whether each product is covered today (KST). */
  async list(agencyId: string, now = new Date()): Promise<AgencySubscriptionsResponse> {
    await this.assertAgency(agencyId);
    const rows = await this.prisma.agencySubscription.findMany({
      where: { agencyId },
      orderBy: [{ startsOn: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: agencySubscriptionSelect,
    });
    const today = kstDate(now);
    const items = rows.map((r) => toSubscriptionView(r, today));
    const current = Object.fromEntries(
      Object.values(SubscriptionProduct).map((p) => [
        p,
        items.some((i) => i.product === p && i.state === AgencySubscriptionState.ACTIVE),
      ]),
    ) as Record<SubscriptionProduct, boolean>;
    return { items, current };
  }

  /** Audited `subscription.create` in the transaction; the public cache is bumped (site gate). */
  async create(
    agencyId: string,
    input: AdminSubscriptionCreateInput,
    admin: AdminPrincipal,
    now = new Date(),
  ): Promise<AgencySubscriptionView> {
    const row = await this.prisma.$transaction(async (tx) => {
      await lockAgency(tx, agencyId);
      await this.assertAgency(agencyId, tx);
      const created = await tx.agencySubscription.create({
        data: {
          agencyId,
          product: input.product,
          startsOn: toDbDate(input.startsOn),
          endsOn: input.endsOn ? toDbDate(input.endsOn) : null,
          amountWon: input.amountWon ?? null,
          memo: input.memo ?? null,
          createdByAdminId: admin.adminId,
        },
        select: agencySubscriptionSelect,
      });
      await this.audit.record(
        {
          action: 'subscription.create',
          resourceType: 'AgencySubscription',
          resourceId: created.id,
          before: null,
          after: snapshot(created),
        },
        tx,
      );
      return created;
    });
    await this.cache.invalidatePublic();
    return toSubscriptionView(row, kstDate(now));
  }

  /**
   * Ends early / extends (`endsOn`, ≥ startsOn → else 400 AGENCY_SUBSCRIPTION_INVALID_PERIOD),
   * edits the memo, or cancels (kept for the record, `canceledAt`; cancelling twice keeps the
   * first time). Audited `subscription.update` / `subscription.cancel`.
   */
  async update(
    id: string,
    input: AdminSubscriptionUpdateInput,
    now = new Date(),
  ): Promise<AgencySubscriptionView> {
    const existing = await this.prisma.agencySubscription.findFirst({
      where: { id, agency: { deletedAt: null } },
      select: { agencyId: true },
    });
    if (!existing) throw AppException.notFound(ErrorCode.AGENCY_SUBSCRIPTION_NOT_FOUND);
    const row = await this.prisma.$transaction(async (tx) => {
      await lockAgency(tx, existing.agencyId);
      const before = await tx.agencySubscription.findUnique({
        where: { id },
        select: agencySubscriptionSelect,
      });
      if (!before) throw AppException.notFound(ErrorCode.AGENCY_SUBSCRIPTION_NOT_FOUND);
      if (input.endsOn && input.endsOn < dateOnly(before.startsOn)) {
        throw AppException.badRequest(ErrorCode.AGENCY_SUBSCRIPTION_INVALID_PERIOD, {
          startsOn: dateOnly(before.startsOn),
          endsOn: input.endsOn,
        });
      }
      const after = await tx.agencySubscription.update({
        where: { id },
        data: {
          ...(input.endsOn !== undefined
            ? { endsOn: input.endsOn ? toDbDate(input.endsOn) : null }
            : {}),
          ...(input.memo !== undefined ? { memo: input.memo } : {}),
          ...(input.cancel && !before.canceledAt ? { canceledAt: now } : {}),
        },
        select: agencySubscriptionSelect,
      });
      await this.audit.record(
        {
          action: input.cancel ? 'subscription.cancel' : 'subscription.update',
          resourceType: 'AgencySubscription',
          resourceId: id,
          before: snapshot(before),
          after: snapshot(after),
        },
        tx,
      );
      return after;
    });
    await this.cache.invalidatePublic();
    return toSubscriptionView(row, kstDate(now));
  }

  private async assertAgency(agencyId: string, db: PrismaTx = this.prisma): Promise<void> {
    const n = await db.agency.count({ where: { id: agencyId, deletedAt: null } });
    if (n !== 1) throw AppException.notFound(ErrorCode.AGENCY_NOT_FOUND);
  }
}
