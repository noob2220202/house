import { createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';
import {
  ADMIN_ROLE_RANK,
  AdminAgencySort,
  AdminRole,
  AgencyMemberStatus,
  AgencyStatus,
  ALLOWED_DOCUMENT_MIME,
  ErrorCode,
  NotificationType,
  RegistryCheckStatus,
  UserRole,
  canAdminTransitionAgency,
  type AdminAgencyDetail,
  type AdminAgencyListItem,
  type AdminAgencyListQuery,
  type AgencyDecisionInput,
  type AgencyRegistryCheck,
  type Paginated,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { AuditService } from '../../../common/audit/audit.service';
import { CacheService } from '../../../common/cache/cache.service';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { AgencyMapper, toMemberView } from '../agency.mapper';
import { agencyMemberSelect, myAgencySelect } from '../agency.selects';
import {
  BROKER_REGISTRY,
  BrokerRegistryUnavailableError,
  type BrokerRegistryClient,
} from '../clients/broker-registry.client';
import { AGENCY_REDIS, REGISTRY_CACHE_TTL_SECONDS } from '../constants';
import { lockAgency } from '../domain/locks';
import { compareWithRegistry } from '../domain/registry-compare';
import { AGENCY_MEDIA, type AgencyMediaPort } from '../ports/agency-media.port';
import { AgencyCacheService } from './agency-cache.service';
import { AgencyInviteStore } from './agency-invite.store';
import { AgencySessionSyncService } from './agency-session-sync.service';

const DECISION_VERB: Record<AgencyDecisionInput['status'], string> = {
  APPROVED: 'approve',
  REJECTED: 'reject',
  SUSPENDED: 'suspend',
};

/** Suspending a live office (its ads disappear) needs ADMIN; approve/reject is OPERATOR work. */
const MIN_ROLE_FOR: Record<AgencyDecisionInput['status'], AdminRole> = {
  APPROVED: AdminRole.OPERATOR,
  REJECTED: AdminRole.OPERATOR,
  SUSPENDED: AdminRole.ADMIN,
};

const INLINE_MIME = new Set<string>(ALLOWED_DOCUMENT_MIME);

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
    @Inject(AGENCY_MEDIA) private readonly media: AgencyMediaPort,
    @Inject(BROKER_REGISTRY) private readonly registry: BrokerRegistryClient,
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
        owner: a.owner,
        documentCount: a._count.documents,
        memberCount: a._count.members,
        warningCount: a.warningCount,
        createdAt: a.createdAt.toISOString(),
        approvedAt: a.approvedAt?.toISOString() ?? null,
      })),
    };
  }

  async detail(agencyId: string, db: PrismaTx = this.prisma): Promise<AdminAgencyDetail> {
    const row = await db.agency.findFirst({
      where: { id: agencyId, deletedAt: null },
      select: {
        ...myAgencySelect,
        warningCount: true,
        owner: {
          select: { id: true, name: true, nickname: true, email: true, phone: true, status: true },
        },
        members: {
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
      members: row.members.map(toMemberView),
      warningCount: row.warningCount,
      recentWarnings: row.warnings.map((w) => ({
        id: w.id,
        reason: w.reason,
        reportId: w.reportId,
        createdAt: w.createdAt.toISOString(),
      })),
    };
  }

  /** 승인 / 반려 / 정지 / 정지 해제, with status history, notification and audit in one transaction. */
  async decide(
    agencyId: string,
    input: AgencyDecisionInput,
    admin: AdminPrincipal,
  ): Promise<AdminAgencyDetail> {
    if (ADMIN_ROLE_RANK[admin.role] < ADMIN_ROLE_RANK[MIN_ROLE_FOR[input.status]]) {
      throw AppException.forbidden(ErrorCode.AGENCY_DECISION_FORBIDDEN);
    }
    const to = input.status;
    const reason = input.reason ?? null;
    const outcome = await this.prisma.$transaction(async (tx) => {
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
        },
      });
      if (!before) throw AppException.notFound(ErrorCode.AGENCY_NOT_FOUND);
      if (!canAdminTransitionAgency(before.status, to)) {
        throw AppException.badRequest(ErrorCode.AGENCY_INVALID_STATUS_TRANSITION, {
          from: before.status,
          to,
        });
      }
      const now = new Date();
      const firstApproval = to === AgencyStatus.APPROVED && before.status === AgencyStatus.PENDING;
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
      return { before, firstApproval };
    });

    const ownerId = outcome.before.ownerUserId;
    if (outcome.firstApproval) {
      await this.sessions.apply(ownerId, { role: UserRole.AGENCY_OWNER, agencyId });
    } else if (to === AgencyStatus.REJECTED) {
      await this.sessions.apply(ownerId, { agencyId: null });
    } else if (to === AgencyStatus.SUSPENDED) {
      await this.invites.revokeAll(agencyId);
    }
    await this.cache.invalidatePublic();
    return this.detail(agencyId);
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
