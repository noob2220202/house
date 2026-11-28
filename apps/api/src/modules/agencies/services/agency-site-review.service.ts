import {
  ADMIN_ROLE_RANK,
  AdminRole,
  AgencySiteDecisionAction,
  AgencySiteStatus,
  ErrorCode,
  NotificationType,
  type AdminAgencySiteDecisionInput,
  type AdminAgencySiteListItem,
  type AdminAgencySiteListQuery,
  type AdminAgencySiteResponse,
  type AgencySiteView,
  type Paginated,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { AuditService } from '../../../common/audit/audit.service';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { agencySiteSelect, type AgencySiteRow } from '../agency-site.selects';
import { lockAgency, lockSiteSlug } from '../domain/locks';
import { isAgencyLive, siteDecisionTarget, toSiteView } from '../domain/sites';
import { AgencyCacheService } from './agency-cache.service';
import { AgencySiteGateService } from './agency-site-gate.service';
import {
  assertUsableSlug,
  rethrowSlugRace,
  siteAuditSnapshot,
  siteSlugTaken,
} from './agency-sites.service';

const DECISION_VERB: Record<AgencySiteDecisionAction, string> = {
  APPROVE: 'approve',
  REJECT: 'reject',
  SUSPEND: 'suspend',
  RESUME: 'resume',
};

/**
 * Approving / rejecting a request is OPERATOR work; taking a live site down and bringing it back
 * needs ADMIN (as for the office itself, AgencyReviewService).
 */
export function minRoleForSiteDecision(action: AgencySiteDecisionAction): AdminRole {
  return action === AgencySiteDecisionAction.SUSPEND || action === AgencySiteDecisionAction.RESUME
    ? AdminRole.ADMIN
    : AdminRole.OPERATOR;
}

const listSelect = {
  ...agencySiteSelect,
  agency: {
    select: { id: true, name: true, representativeName: true, status: true, deletedAt: true },
  },
} satisfies Prisma.AgencySiteSelect;

/** Admin queue and decisions of 사무소 홈페이지 requests (approve with an edited slug, reject, suspend, resume). */
@Injectable()
export class AgencySiteReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gate: AgencySiteGateService,
    private readonly cache: AgencyCacheService,
    private readonly audit: AuditService,
  ) {}

  /**
   * REQUESTED: oldest request first (the queue); otherwise most recently decided first (the
   * admin's '최근 처리 순' next to the 처리일 column — not updatedAt, which an owner's colour /
   * 한 줄 소개 edit bumps), open requests last.
   */
  async list(q: AdminAgencySiteListQuery): Promise<Paginated<AdminAgencySiteListItem>> {
    const where: Prisma.AgencySiteWhereInput = {
      agency: { deletedAt: null },
      ...(q.status ? { status: q.status } : {}),
      ...(q.q
        ? {
            OR: [
              { slug: { contains: q.q.toLowerCase() } },
              { requestedSlug: { contains: q.q.toLowerCase() } },
              { agency: { name: { contains: q.q, mode: 'insensitive' } } },
              { agency: { representativeName: { contains: q.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.AgencySiteOrderByWithRelationInput[] =
      q.status === AgencySiteStatus.REQUESTED
        ? [{ requestedAt: 'asc' }, { id: 'asc' }]
        : [{ decidedAt: { sort: 'desc', nulls: 'last' } }, { requestedAt: 'desc' }, { id: 'desc' }];
    const page = await paginate(
      q,
      (args) => this.prisma.agencySite.findMany({ where, orderBy, ...args, select: listSelect }),
      () => this.prisma.agencySite.count({ where }),
    );
    const subs = await this.gate.siteSubscriptions(page.items.map((s) => s.agencyId));
    return {
      ...page,
      items: page.items.map((row) => {
        const { agency, ...site } = row;
        const sub = subs.get(row.agencyId) ?? { required: false, active: false, endsOn: null };
        return {
          site: toSiteView(site, this.gate.context(isAgencyLive(agency), sub)),
          agency: {
            id: agency.id,
            name: agency.name,
            representativeName: agency.representativeName,
            status: agency.status,
          },
        };
      }),
    };
  }

  async get(agencyId: string): Promise<AdminAgencySiteResponse> {
    const agency = await this.prisma.agency.findFirst({
      where: { id: agencyId, deletedAt: null },
      select: { status: true, deletedAt: true, site: { select: agencySiteSelect } },
    });
    if (!agency) throw AppException.notFound(ErrorCode.AGENCY_NOT_FOUND);
    return { site: agency.site ? await this.view(agency.site, isAgencyLive(agency)) : null };
  }

  /**
   * APPROVE (REQUESTED → ACTIVE, slug = body.slug ?? requestedSlug, 409 when another office holds
   * it; a changed slug resets httpsReadyAt so deploy/sites.sh issues its certificate), REJECT
   * (→ REJECTED, reason), SUSPEND (ACTIVE → SUSPENDED, reason), RESUME (SUSPENDED → ACTIVE).
   * Approve / reject notify the owner; every decision is audited `agency_site.<verb>` in the
   * transaction and bumps the public cache.
   */
  async decide(
    agencyId: string,
    input: AdminAgencySiteDecisionInput,
    admin: AdminPrincipal,
  ): Promise<AdminAgencySiteResponse> {
    if (ADMIN_ROLE_RANK[admin.role] < ADMIN_ROLE_RANK[minRoleForSiteDecision(input.action)]) {
      throw AppException.forbidden(ErrorCode.AGENCY_DECISION_FORBIDDEN);
    }
    const after = await this.prisma
      .$transaction(async (tx) => {
        await lockAgency(tx, agencyId);
        const agency = await tx.agency.findFirst({
          where: { id: agencyId, deletedAt: null },
          select: { id: true, name: true, ownerUserId: true, status: true, deletedAt: true },
        });
        if (!agency) throw AppException.notFound(ErrorCode.AGENCY_NOT_FOUND);
        const before = await tx.agencySite.findUnique({
          where: { agencyId },
          select: agencySiteSelect,
        });
        if (!before) throw AppException.notFound(ErrorCode.AGENCY_SITE_NOT_FOUND);
        const to = siteDecisionTarget(before.status, input.action);
        if (!to) {
          throw AppException.conflict(ErrorCode.AGENCY_SITE_INVALID_TRANSITION, {
            from: before.status,
            action: input.action,
          });
        }
        const now = new Date();
        const data: Prisma.AgencySiteUncheckedUpdateManyInput = {
          status: to,
          decidedAt: now,
          decidedByAdminId: admin.adminId,
        };
        switch (input.action) {
          case AgencySiteDecisionAction.APPROVE: {
            const slug = input.slug ?? before.requestedSlug;
            if (!slug) throw AppException.badRequest(ErrorCode.AGENCY_SITE_SLUG_INVALID);
            assertUsableSlug(this.gate.slugProblem(slug));
            await lockSiteSlug(tx, slug);
            if (await siteSlugTaken(tx, slug, agencyId)) {
              throw AppException.conflict(ErrorCode.AGENCY_SITE_SLUG_DUPLICATE);
            }
            Object.assign(data, {
              slug,
              decisionReason: null,
              // A new host needs its own certificate before it is linked as live.
              ...(before.slug !== slug ? { httpsReadyAt: null } : {}),
            });
            break;
          }
          case AgencySiteDecisionAction.REJECT:
          case AgencySiteDecisionAction.SUSPEND:
            data.decisionReason = input.reason ?? null;
            break;
          case AgencySiteDecisionAction.RESUME:
            data.decisionReason = null;
            break;
        }
        const updated = await tx.agencySite.updateMany({
          where: { id: before.id, status: before.status },
          data,
        });
        if (updated.count !== 1) {
          throw AppException.conflict(ErrorCode.AGENCY_SITE_INVALID_TRANSITION);
        }
        const site = await tx.agencySite.findUniqueOrThrow({
          where: { id: before.id },
          select: agencySiteSelect,
        });
        const notification = this.notificationFor(input.action, agency, site);
        if (notification) {
          await tx.notification.create({ data: { userId: agency.ownerUserId, ...notification } });
        }
        await this.audit.record(
          {
            action: `agency_site.${DECISION_VERB[input.action]}`,
            resourceType: 'AgencySite',
            resourceId: before.id,
            before: siteAuditSnapshot(before),
            after: { ...siteAuditSnapshot(site), agencyId },
          },
          tx,
        );
        return { site, agencyLive: isAgencyLive(agency) };
      })
      .catch(rethrowSlugRace);
    await this.cache.invalidatePublic();
    return { site: await this.view(after.site, after.agencyLive) };
  }

  private async view(site: AgencySiteRow, agencyLive: boolean): Promise<AgencySiteView> {
    const sub = await this.gate.siteSubscription(site.agencyId);
    return toSiteView(site, this.gate.context(agencyLive, sub));
  }

  /** Owner notification (agency feed: `data.agencyId`); suspend / resume send none. */
  private notificationFor(
    action: AgencySiteDecisionAction,
    agency: { id: string; name: string },
    site: AgencySiteRow,
  ): {
    type: NotificationType;
    title: string;
    body: string | null;
    data: Prisma.InputJsonObject;
  } | null {
    const data = { agencyId: agency.id, siteId: site.id };
    if (action === AgencySiteDecisionAction.APPROVE && site.slug) {
      return {
        type: NotificationType.AGENCY_SITE_APPROVED,
        title: `${agency.name} 홈페이지 신청이 승인되었습니다.`,
        // Not open yet: deploy/sites.sh issues the host's certificate on its next run (≤ 5 min,
        // then the certificate itself), so the copy never claims the address works right now.
        body: `홈페이지 주소: ${this.gate.urlFor(site.slug)} (주소는 보통 10분 안에 열려요)`,
        data: { ...data, slug: site.slug },
      };
    }
    if (action === AgencySiteDecisionAction.REJECT) {
      return {
        type: NotificationType.AGENCY_SITE_REJECTED,
        title: `${agency.name} 홈페이지 신청이 반려되었습니다.`,
        body: site.decisionReason,
        data,
      };
    }
    return null;
  }
}
