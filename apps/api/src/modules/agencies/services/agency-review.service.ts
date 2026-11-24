import { createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';
import {
  ADMIN_DELETABLE_AGENCY_STATUSES,
  ADMIN_ROLE_RANK,
  AdminAgencySort,
  AdminRole,
  AgencyMemberStatus,
  AgencyStatus,
  ALLOWED_DOCUMENT_MIME,
  ErrorCode,
  NotificationType,
  REGISTRATION_HOLDING_STATUSES,
  RegistryCheckStatus,
  UserRole,
  canAdminTransitionAgency,
  maskEmail,
  maskPhone,
  sggCodeOf,
  type AdminAgencyDetail,
  type AdminAgencyDetailQuery,
  type AdminAgencyListItem,
  type AdminAgencyListQuery,
  type AgencyAdminDeleteInput,
  type AgencyDecisionInput,
  type AgencyLocationUpdateInput,
  type AgencyRegistryCheck,
  type Paginated,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { AuditService } from '../../../common/audit/audit.service';
import { AdsInvalidationService } from '../../ads/services/ads-invalidation.service';
import { CacheService } from '../../../common/cache/cache.service';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { AgencyMapper, maskName, toMemberView } from '../agency.mapper';
import { agencyMemberSelect, myAgencySelect } from '../agency.selects';
import {
  BROKER_REGISTRY,
  BrokerRegistryUnavailableError,
  type BrokerRegistryClient,
} from '../clients/broker-registry.client';
import { AGENCY_REDIS, REGISTRY_CACHE_TTL_SECONDS } from '../constants';
import { lockAgency, lockRegistrationKey } from '../domain/locks';
import { isUniqueViolation } from '../domain/prisma-errors';
import { compareWithRegistry } from '../domain/registry-compare';
import { AGENCY_LISTINGS_SYNC, type AgencyListingsSync } from '../ports/agency-listings.sync';
import { AGENCY_MEDIA, type AgencyMediaPort } from '../ports/agency-media.port';
import { AgencyCacheService } from './agency-cache.service';
import { AgencyInviteStore } from './agency-invite.store';
import { AgencySessionSyncService } from './agency-session-sync.service';

const DECISION_VERB: Record<AgencyDecisionInput['status'], string> = {
  APPROVED: 'approve',
  REJECTED: 'reject',
  SUSPENDED: 'suspend',
};

/**
 * Suspending a live office (its ads disappear) and lifting a suspension both need ADMIN;
 * approving / rejecting a pending application is OPERATOR work.
 */
function minRoleForTransition(from: AgencyStatus, to: AgencyStatus): AdminRole {
  return from === AgencyStatus.SUSPENDED || to === AgencyStatus.SUSPENDED
    ? AdminRole.ADMIN
    : AdminRole.OPERATOR;
}

/** Statuses in which an agency's listings are publicly advertised. */
const isPublic = (s: AgencyStatus): boolean => s === AgencyStatus.APPROVED;

const INLINE_MIME = new Set<string>(ALLOWED_DOCUMENT_MIME);

/** statusReason of pending applications rejected because another office got the 등록번호. */
export const DUPLICATE_REGISTRATION_REJECT_REASON =
  '동일한 등록번호의 다른 중개사무소 신청이 승인되어 자동 반려되었습니다. 등록번호를 확인해 주세요.';

/** Fields of the full detail view, recorded (names only) in the 개인정보 접속기록. */
const DETAIL_PII_FIELDS = [
  'owner.name',
  'owner.email',
  'owner.phone',
  'members.phone',
  'members.licenseNumber',
] as const;

/** Masks contacts of a detail view (mutation responses, REMOVED staff). */
function maskDetail(d: AdminAgencyDetail): AdminAgencyDetail {
  return {
    ...d,
    owner: {
      ...d.owner,
      name: maskName(d.owner.name),
      email: maskEmail(d.owner.email),
      phone: d.owner.phone ? maskPhone(d.owner.phone) : null,
    },
    members: d.members.map((m) => ({ ...m, phone: m.phone ? maskPhone(m.phone) : null })),
  };
}

interface CompetitorRow {
  id: string;
  name: string;
  owner_user_id: string;
}

export interface DocumentFile {
  path: string;
  mimeType: string;
  sizeBytes: number;
  filename: string;
  inline: boolean;
}

/** Admin review of agencies: queue, detail, decisions with history + audit, private documents. */
@Injectable()
export class AgencyReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: AgencyMapper,
    private readonly audit: AuditService,
    private readonly cache: AgencyCacheService,
    private readonly jsonCache: CacheService,
    private readonly sessions: AgencySessionSyncService,
    private readonly invites: AgencyInviteStore,
    private readonly config: AppConfig,
    @Inject(AGENCY_LISTINGS_SYNC) private readonly listings: AgencyListingsSync,
    @Inject(AGENCY_MEDIA) private readonly media: AgencyMediaPort,
    @Inject(BROKER_REGISTRY) private readonly registry: BrokerRegistryClient,
    private readonly ads: AdsInvalidationService,
  ) {}

  async list(q: AdminAgencyListQuery): Promise<Paginated<AdminAgencyListItem>> {
    const where: Prisma.AgencyWhereInput = {
      deletedAt: null,
      ...(q.status?.length ? { status: { in: q.status } } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: 'insensitive' } },
              { representativeName: { contains: q.q, mode: 'insensitive' } },
              { roadAddress: { contains: q.q, mode: 'insensitive' } },
              { registrationNumber: { contains: q.q } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.AgencyOrderByWithRelationInput[] =
      q.sort === AdminAgencySort.NEWEST
        ? [{ createdAt: 'desc' }, { id: 'desc' }]
        : q.sort === AdminAgencySort.NAME
          ? [{ name: 'asc' }, { id: 'asc' }]
          : [{ createdAt: 'asc' }, { id: 'asc' }];
    const page = await paginate(
      q,
      (args) =>
        this.prisma.agency.findMany({
          where,
          orderBy,
          ...args,
          select: {
            id: true,
            name: true,
            representativeName: true,
            registrationNumber: true,
            phone: true,
            roadAddress: true,
            status: true,
            warningCount: true,
            createdAt: true,
            approvedAt: true,
            owner: { select: { id: true, name: true, email: true } },
            _count: {
              select: {
                documents: true,
                members: { where: { status: AgencyMemberStatus.ACTIVE } },
              },
            },
          },
        }),
      () => this.prisma.agency.count({ where }),
    );
    return {
      ...page,
      items: page.items.map((a) => ({
        id: a.id,
        name: a.name,
        representativeName: a.representativeName,
        registrationNumber: a.registrationNumber,
        phone: a.phone,
        roadAddress: a.roadAddress,
        status: a.status,
        owner: { id: a.owner.id, name: maskName(a.owner.name), email: maskEmail(a.owner.email) },
        documentCount: a._count.documents,
        memberCount: a._count.members,
        warningCount: a.warningCount,
        createdAt: a.createdAt.toISOString(),
        approvedAt: a.approvedAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Full agency record with owner and staff contacts unmasked. Viewing it is a 개인정보 접속기록
   * (안전성 확보조치 기준 제8조), so it writes an `agency.pii-view` audit row naming the fields shown,
   * never their values. REMOVED staff are included only on request, with phones masked.
   */
  async detail(agencyId: string, q: AdminAgencyDetailQuery): Promise<AdminAgencyDetail> {
    const detail = await this.build(agencyId, q.includeRemoved);
    await this.audit.record({
      action: 'agency.pii-view',
      resourceType: 'Agency',
      resourceId: agencyId,
      after: { fields: [...DETAIL_PII_FIELDS], includeRemoved: q.includeRemoved },
    });
    return detail;
  }

  private async build(agencyId: string, includeRemoved = false): Promise<AdminAgencyDetail> {
    const row = await this.prisma.agency.findFirst({
      where: { id: agencyId, deletedAt: null },
      select: {
        ...myAgencySelect,
        warningCount: true,
        owner: {
          select: { id: true, name: true, nickname: true, email: true, phone: true, status: true },
        },
        members: {
          ...(includeRemoved ? {} : { where: { status: { not: AgencyMemberStatus.REMOVED } } }),
          select: agencyMemberSelect,
          orderBy: [{ status: 'asc' }, { role: 'asc' }, { joinedAt: 'asc' }],
          take: 100,
        },
        warnings: {
          select: { id: true, reason: true, reportId: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!row) throw AppException.notFound(ErrorCode.AGENCY_NOT_FOUND);
    return {
      ...this.mapper.mine(row),
      owner: row.owner,
      members: row.members.map((m) => {
        const view = toMemberView(m);
        return m.status === AgencyMemberStatus.REMOVED
          ? { ...view, phone: view.phone ? maskPhone(view.phone) : null }
          : view;
      }),
      warningCount: row.warningCount,
      recentWarnings: row.warnings.map((w) => ({
        id: w.id,
        reason: w.reason,
        reportId: w.reportId,
        createdAt: w.createdAt.toISOString(),
      })),
    };
  }

  /** Mutation responses carry the masked detail; the full view is GET /admin/agencies/:id. */
  private async maskedDetail(agencyId: string): Promise<AdminAgencyDetail> {
    return maskDetail(await this.build(agencyId));
  }

  /** 승인 / 반려 / 정지 / 정지 해제, with status history, notification and audit in one transaction. */
  async decide(
    agencyId: string,
    input: AgencyDecisionInput,
    admin: AdminPrincipal,
  ): Promise<AdminAgencyDetail> {
    // Every decision needs at least OPERATOR; the transition-specific check runs on `before`.
    if (ADMIN_ROLE_RANK[admin.role] < ADMIN_ROLE_RANK[AdminRole.OPERATOR]) {
      throw AppException.forbidden(ErrorCode.AGENCY_DECISION_FORBIDDEN);
    }
    const to = input.status;
    const reason = input.reason ?? null;
    const outcome = await this.prisma
      .$transaction(async (tx) => {
        await lockAgency(tx, agencyId);
        const before = await tx.agency.findFirst({
          where: { id: agencyId, deletedAt: null },
          select: {
            id: true,
            name: true,
            status: true,
            statusReason: true,
            ownerUserId: true,
            approvedAt: true,
            suspendedAt: true,
            registrationKey: true,
          },
        });
        if (!before) throw AppException.notFound(ErrorCode.AGENCY_NOT_FOUND);
        const required = minRoleForTransition(before.status, to);
        if (ADMIN_ROLE_RANK[admin.role] < ADMIN_ROLE_RANK[required]) {
          throw AppException.forbidden(ErrorCode.AGENCY_DECISION_FORBIDDEN);
        }
        if (!canAdminTransitionAgency(before.status, to)) {
          throw AppException.badRequest(ErrorCode.AGENCY_INVALID_STATUS_TRANSITION, {
            from: before.status,
            to,
          });
        }
        const now = new Date();
        const firstApproval =
          to === AgencyStatus.APPROVED && before.status === AgencyStatus.PENDING;
        // Going live takes the 등록번호: refuse if another live office holds it (pending ones lose).
        const goesLive = to === AgencyStatus.APPROVED && before.status !== AgencyStatus.SUSPENDED;
        const key = goesLive ? before.registrationKey : null;
        if (key) {
          await lockRegistrationKey(tx, key);
          const holder = await tx.agency.findFirst({
            where: {
              registrationKey: key,
              deletedAt: null,
              status: { in: [...REGISTRATION_HOLDING_STATUSES] },
              id: { not: agencyId },
            },
            select: { id: true },
          });
          if (holder) {
            throw AppException.conflict(ErrorCode.AGENCY_REGISTRATION_DUPLICATE, {
              agencyId: holder.id,
            });
          }
        }
        const updated = await tx.agency.updateMany({
          where: { id: agencyId, status: before.status },
          data: {
            status: to,
            statusReason: reason,
            ...(firstApproval && !before.approvedAt ? { approvedAt: now } : {}),
            ...(to === AgencyStatus.APPROVED ? { suspendedAt: null } : {}),
            ...(to === AgencyStatus.SUSPENDED ? { suspendedAt: now } : {}),
          },
        });
        if (updated.count !== 1) throw AppException.conflict(ErrorCode.AGENCY_STATUS_CONFLICT);
        const visibilityChanged = isPublic(before.status) !== isPublic(to);
        // Suspension takes the office's listings off public search (primary must be APPROVED).
        if (visibilityChanged) await this.listings.agencyVisibilityChanged(tx, agencyId);
        await tx.agencyStatusHistory.create({
          data: {
            agencyId,
            fromStatus: before.status,
            toStatus: to,
            reason,
            decidedByAdminId: admin.adminId,
          },
        });
        if (firstApproval) {
          await tx.user.update({
            where: { id: before.ownerUserId },
            data: { role: UserRole.AGENCY_OWNER },
          });
        }
        await tx.notification.create({
          data: { userId: before.ownerUserId, ...this.notificationFor(before, to, reason) },
        });
        await this.audit.record(
          {
            action: `agency.${before.status === AgencyStatus.SUSPENDED ? 'reinstate' : DECISION_VERB[to]}`,
            resourceType: 'Agency',
            resourceId: agencyId,
            before: { status: before.status, statusReason: before.statusReason },
            after: { status: to, statusReason: reason },
          },
          tx,
        );
        const rejectedOwners = key ? await this.rejectCompetitors(tx, agencyId, key, admin) : [];
        return { before, firstApproval, visibilityChanged, rejectedOwners };
      })
      .catch((err: unknown) => {
        // Backstop for the partial unique index agencies_registration_key_live.
        if (isUniqueViolation(err, 'registrationKey')) {
          throw AppException.conflict(ErrorCode.AGENCY_REGISTRATION_DUPLICATE);
        }
        throw err;
      });

    const ownerId = outcome.before.ownerUserId;
    if (outcome.firstApproval) {
      await this.sessions.apply(ownerId, { role: UserRole.AGENCY_OWNER, agencyId });
    } else if (to === AgencyStatus.REJECTED) {
      await this.sessions.apply(ownerId, { agencyId: null });
    } else if (to === AgencyStatus.SUSPENDED) {
      await this.invites.revokeAll(agencyId);
    }
    for (const owner of outcome.rejectedOwners) {
      await this.sessions.apply(owner, { agencyId: null });
    }
    await this.cache.invalidatePublic();
    if (outcome.visibilityChanged) {
      await this.listings.invalidateSearch();
      await this.ads.agencyStatusChanged();
    }
    return this.maskedDetail(agencyId);
  }

  /**
   * Rejects the other PENDING applications for a 등록번호 that just went live (one office, one
   * number), with history, notification and audit. Conditional on PENDING, so a concurrent owner
   * edit or admin decision on a competitor simply wins or loses its row lock; no agency lock is
   * taken here (lock order). Returns the owners whose sessions must drop the application.
   */
  private async rejectCompetitors(
    tx: PrismaTx,
    approvedId: string,
    registrationKey: string,
    admin: AdminPrincipal,
  ): Promise<string[]> {
    const reason = DUPLICATE_REGISTRATION_REJECT_REASON;
    const rows = await tx.$queryRaw<CompetitorRow[]>`
      UPDATE agencies
      SET status = 'REJECTED'::agency_status, status_reason = ${reason}, updated_at = now()
      WHERE registration_key = ${registrationKey}
        AND deleted_at IS NULL
        AND status = 'PENDING'::agency_status
        AND id <> ${approvedId}::uuid
      RETURNING id, name, owner_user_id`;
    if (rows.length === 0) return [];
    await tx.agencyStatusHistory.createMany({
      data: rows.map((r) => ({
        agencyId: r.id,
        fromStatus: AgencyStatus.PENDING,
        toStatus: AgencyStatus.REJECTED,
        reason,
        decidedByAdminId: admin.adminId,
      })),
    });
    await tx.notification.createMany({
      data: rows.map((r) => ({
        userId: r.owner_user_id,
        ...this.notificationFor(
          { id: r.id, name: r.name, status: AgencyStatus.PENDING },
          AgencyStatus.REJECTED,
          reason,
        ),
      })),
    });
    for (const r of rows) {
      await this.audit.record(
        {
          action: 'agency.reject',
          resourceType: 'Agency',
          resourceId: r.id,
          before: { status: AgencyStatus.PENDING },
          after: {
            status: AgencyStatus.REJECTED,
            statusReason: reason,
            duplicateOfAgencyId: approvedId,
          },
        },
        tx,
      );
    }
    return rows.map((r) => r.owner_user_id);
  }

  /**
   * Soft-deletes an application that never went live (PENDING / REJECTED), e.g. a fake one, so
   * nothing of it lingers in the queue or the applicant's account. A pending one is rejected
   * first (history row). Staff rows are closed, the applicant is notified, the action audited.
   * Documents are kept as evidence until the retention purge erases the application 1 year after
   * its rejection (AgencyRetentionService).
   */
  async remove(
    agencyId: string,
    input: AgencyAdminDeleteInput,
    admin: AdminPrincipal,
  ): Promise<void> {
    const before = await this.prisma.$transaction(async (tx) => {
      await lockAgency(tx, agencyId);
      const row = await tx.agency.findFirst({
        where: { id: agencyId, deletedAt: null },
        select: {
          id: true,
          name: true,
          status: true,
          statusReason: true,
          ownerUserId: true,
          registrationNumber: true,
        },
      });
      if (!row) throw AppException.notFound(ErrorCode.AGENCY_NOT_FOUND);
      if (!ADMIN_DELETABLE_AGENCY_STATUSES.includes(row.status)) {
        throw AppException.badRequest(ErrorCode.AGENCY_NOT_DELETABLE, { status: row.status });
      }
      const now = new Date();
      const updated = await tx.agency.updateMany({
        where: { id: agencyId, status: row.status, deletedAt: null },
        data: { status: AgencyStatus.REJECTED, statusReason: input.reason, deletedAt: now },
      });
      if (updated.count !== 1) throw AppException.conflict(ErrorCode.AGENCY_STATUS_CONFLICT);
      if (row.status === AgencyStatus.PENDING) {
        await tx.agencyStatusHistory.create({
          data: {
            agencyId,
            fromStatus: AgencyStatus.PENDING,
            toStatus: AgencyStatus.REJECTED,
            reason: input.reason,
            decidedByAdminId: admin.adminId,
          },
        });
      }
      await tx.agencyMember.updateMany({
        where: { agencyId, status: { not: AgencyMemberStatus.REMOVED } },
        data: { status: AgencyMemberStatus.REMOVED, removedAt: now },
      });
      await tx.notification.create({
        data: {
          userId: row.ownerUserId,
          type: NotificationType.AGENCY_REJECTED,
          title: '중개사무소 등록 신청이 삭제되었습니다.',
          body: input.reason,
          data: { agencyId },
        },
      });
      await this.audit.record(
        {
          action: 'agency.delete',
          resourceType: 'Agency',
          resourceId: agencyId,
          before: {
            status: row.status,
            statusReason: row.statusReason,
            registrationNumber: row.registrationNumber,
            deletedAt: null,
          },
          after: {
            status: AgencyStatus.REJECTED,
            statusReason: input.reason,
            deletedAt: now.toISOString(),
          },
        },
        tx,
      );
      return row;
    });
    // A pending owner acted for the application (a rejected one was already detached).
    if (before.status === AgencyStatus.PENDING) {
      await this.sessions.apply(before.ownerUserId, { agencyId: null });
    }
  }

  /**
   * 소재지 변경 of an approved / suspended office after the admin checked its 이전신고 (the owner
   * cannot edit these fields once approved). Audited with before/after; the owner is notified.
   */
  async updateLocation(
    agencyId: string,
    input: AgencyLocationUpdateInput,
  ): Promise<AdminAgencyDetail> {
    const { reason, ...fields } = input;
    await this.prisma.$transaction(async (tx) => {
      await lockAgency(tx, agencyId);
      const before = await tx.agency.findFirst({
        where: { id: agencyId, deletedAt: null },
        select: {
          id: true,
          name: true,
          ownerUserId: true,
          status: true,
          roadAddress: true,
          jibunAddress: true,
          addressDetail: true,
          zipCode: true,
          emdCode: true,
          sggCode: true,
          lat: true,
          lng: true,
        },
      });
      if (!before) throw AppException.notFound(ErrorCode.AGENCY_NOT_FOUND);
      // Pending / rejected applications are corrected by the owner (PATCH mine / resubmit).
      if (before.status !== AgencyStatus.APPROVED && before.status !== AgencyStatus.SUSPENDED) {
        throw AppException.badRequest(ErrorCode.AGENCY_NOT_EDITABLE);
      }
      const sggCode =
        fields.emdCode !== undefined
          ? fields.emdCode
            ? sggCodeOf(fields.emdCode)
            : this.config.get('REGION_SGG_CODE')
          : before.sggCode;
      await tx.agency.update({
        where: { id: agencyId },
        data: {
          roadAddress: fields.roadAddress,
          jibunAddress: fields.jibunAddress,
          addressDetail: fields.addressDetail,
          zipCode: fields.zipCode,
          emdCode: fields.emdCode,
          lat: fields.lat,
          lng: fields.lng,
          sggCode,
        },
      });
      const { id: _id, name, ownerUserId, status: _status, ...location } = before;
      await this.audit.record(
        {
          action: 'agency.location.update',
          resourceType: 'Agency',
          resourceId: agencyId,
          before: location,
          after: { ...location, ...fields, sggCode, reason },
        },
        tx,
      );
      await tx.notification.create({
        data: {
          userId: ownerUserId,
          type: NotificationType.SYSTEM,
          title: `${name} 중개사무소 소재지 정보가 변경되었습니다.`,
          body: fields.roadAddress ?? null,
          data: { agencyId },
        },
      });
    });
    await this.cache.invalidatePublic();
    return this.maskedDetail(agencyId);
  }

  /** Resolves a private document file for the authorized admin download. */
  async documentFile(agencyId: string, docId: string): Promise<DocumentFile> {
    const doc = await this.prisma.agencyDocument.findFirst({
      where: { id: docId, agencyId, agency: { deletedAt: null } },
      select: {
        id: true,
        type: true,
        media: { select: { storageKey: true, mimeType: true, deletedAt: true } },
      },
    });
    if (!doc || doc.media.deletedAt)
      throw AppException.notFound(ErrorCode.AGENCY_DOCUMENT_NOT_FOUND);
    const filePath = this.media.privateFilePath(doc.media.storageKey);
    const info = filePath ? await stat(filePath).catch(() => null) : null;
    if (!filePath || !info?.isFile()) {
      throw AppException.notFound(ErrorCode.AGENCY_DOCUMENT_NOT_FOUND);
    }
    this.audit.recordSafe({
      action: 'agency.document.view',
      resourceType: 'AgencyDocument',
      resourceId: doc.id,
      after: { agencyId, type: doc.type },
    });
    const ext = doc.media.mimeType === 'application/pdf' ? 'pdf' : doc.media.mimeType.split('/')[1];
    return {
      path: filePath,
      mimeType: doc.media.mimeType,
      sizeBytes: info.size,
      filename: `agency-${agencyId.slice(0, 8)}-${doc.type.toLowerCase()}.${ext ?? 'bin'}`,
      inline: INLINE_MIME.has(doc.media.mimeType),
    };
  }

  /** Compares the application with the public broker registry (cached a day; `refresh` bypasses). */
  async registryCheck(agencyId: string, refresh: boolean): Promise<AgencyRegistryCheck> {
    const agency = await this.prisma.agency.findFirst({
      where: { id: agencyId, deletedAt: null },
      select: { name: true, representativeName: true, registrationNumber: true, sggCode: true },
    });
    if (!agency) throw AppException.notFound(ErrorCode.AGENCY_NOT_FOUND);
    const fingerprint = createHash('sha1')
      .update([agency.registrationNumber, agency.name, agency.representativeName].join('|'))
      .digest('hex')
      .slice(0, 12);
    const key = `${AGENCY_REDIS.registryCheck(agencyId)}:${fingerprint}`;
    if (!refresh) {
      const hit = await this.jsonCache.get<AgencyRegistryCheck>(key);
      if (hit) return hit;
    }
    const unavailable = (): AgencyRegistryCheck => ({
      status: RegistryCheckStatus.UNAVAILABLE,
      checkedAt: new Date().toISOString(),
      record: null,
      mismatches: [],
    });
    if (!this.registry.enabled) return unavailable();
    try {
      const record = await this.registry.findByRegistrationNumber(
        agency.registrationNumber,
        agency.sggCode,
      );
      const result: AgencyRegistryCheck = {
        ...compareWithRegistry(agency, record),
        checkedAt: new Date().toISOString(),
        record,
      };
      await this.jsonCache.set(key, result, REGISTRY_CACHE_TTL_SECONDS);
      return result;
    } catch (err) {
      if (err instanceof BrokerRegistryUnavailableError) return unavailable();
      throw err;
    }
  }

  private notificationFor(
    agency: { id: string; name: string; status: AgencyStatus },
    to: AgencyDecisionInput['status'],
    reason: string | null,
  ): { type: NotificationType; title: string; body: string | null; data: Prisma.InputJsonObject } {
    const data = { agencyId: agency.id };
    if (to === AgencyStatus.APPROVED && agency.status === AgencyStatus.PENDING) {
      return {
        type: NotificationType.AGENCY_APPROVED,
        title: `${agency.name} 중개사무소 등록이 승인되었습니다.`,
        body: null,
        data,
      };
    }
    if (to === AgencyStatus.APPROVED) {
      return {
        type: NotificationType.SYSTEM,
        title: '중개사무소 이용 정지가 해제되었습니다.',
        body: null,
        data,
      };
    }
    if (to === AgencyStatus.REJECTED) {
      return {
        type: NotificationType.AGENCY_REJECTED,
        title: '중개사무소 등록 신청이 반려되었습니다.',
        body: reason,
        data,
      };
    }
    return {
      type: NotificationType.SYSTEM,
      title: '중개사무소 이용이 정지되었습니다.',
      body: reason,
      data,
    };
  }
}
