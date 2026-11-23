import {
  AgencyMemberRole,
  AgencyMemberStatus,
  AgencyStatus,
  ErrorCode,
  NotificationType,
  toAgencyDisclosure,
  type AgencyDisclosure,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { disclosureSelect } from '../agency.selects';
import { AgencyCacheService } from './agency-cache.service';

export interface ActiveMember {
  memberId: string;
  agencyId: string;
  userId: string;
  role: AgencyMemberRole;
  displayName: string;
  phone: string | null;
  agencyStatus: AgencyStatus;
}

export interface AssertMemberOptions {
  /** Require the agency to be APPROVED (default true): PENDING/SUSPENDED agencies cannot act. */
  requireApproved?: boolean;
  /** Require the OWNER member role. */
  requireOwner?: boolean;
}

/**
 * Public surface of the agencies module for other modules (listings, deal-requests, admin):
 * membership checks, 표시·광고 disclosure data and warnings. Import AgenciesModule and inject this;
 * do not query agency tables directly.
 */
@Injectable()
export class AgenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AgencyCacheService,
  ) {}

  /**
   * The user's ACTIVE membership in `agencyId`. Throws 403 AGENCY_MEMBERSHIP_REQUIRED when the
   * user is not an active member, AGENCY_NOT_APPROVED when the agency cannot act.
   */
  async assertActiveMember(
    userId: string,
    agencyId: string | null | undefined,
    opts: AssertMemberOptions = {},
    db: PrismaTx = this.prisma,
  ): Promise<ActiveMember> {
    if (!agencyId) throw AppException.forbidden(ErrorCode.AGENCY_MEMBERSHIP_REQUIRED);
    const member = await db.agencyMember.findUnique({
      where: { agencyId_userId: { agencyId, userId } },
      select: {
        id: true,
        role: true,
        status: true,
        displayName: true,
        phone: true,
        agency: { select: { status: true, deletedAt: true } },
      },
    });
    if (!member || member.status !== AgencyMemberStatus.ACTIVE || member.agency.deletedAt) {
      throw AppException.forbidden(ErrorCode.AGENCY_MEMBERSHIP_REQUIRED);
    }
    if (opts.requireOwner && member.role !== AgencyMemberRole.OWNER) {
      throw AppException.forbidden(ErrorCode.AGENCY_MEMBERSHIP_REQUIRED);
    }
    if ((opts.requireApproved ?? true) && member.agency.status !== AgencyStatus.APPROVED) {
      throw AppException.forbidden(ErrorCode.AGENCY_NOT_APPROVED);
    }
    return {
      memberId: member.id,
      agencyId,
      userId,
      role: member.role,
      displayName: member.displayName,
      phone: member.phone,
      agencyStatus: member.agency.status,
    };
  }

  /** An ACTIVE member of `agencyId` by member id (e.g. the contact person of a listing), or null. */
  async findActiveMember(
    agencyId: string,
    memberId: string,
  ): Promise<{ id: string; displayName: string; phone: string | null } | null> {
    return this.prisma.agencyMember.findFirst({
      where: { id: memberId, agencyId, status: AgencyMemberStatus.ACTIVE },
      select: { id: true, displayName: true, phone: true },
    });
  }

  /** Whether the agency exists, is not deleted and is APPROVED. */
  async isApproved(agencyId: string): Promise<boolean> {
    const n = await this.prisma.agency.count({
      where: { id: agencyId, status: AgencyStatus.APPROVED, deletedAt: null },
    });
    return n === 1;
  }

  /**
   * 표시·광고 명시사항 of an APPROVED agency (명칭·소재지·연락처·등록번호·대표자 성명), or null when the
   * agency cannot advertise. Listings feed this into the publish validator and the ad footer.
   */
  async getDisclosure(
    agencyId: string,
    db: PrismaTx = this.prisma,
  ): Promise<AgencyDisclosure | null> {
    const row = await db.agency.findFirst({
      where: { id: agencyId, status: AgencyStatus.APPROVED, deletedAt: null },
      select: disclosureSelect,
    });
    return row ? toAgencyDisclosure(row) : null;
  }

  /** Batch variant (no N+1): agencyId → disclosure, APPROVED agencies only. */
  async getDisclosures(agencyIds: readonly string[]): Promise<Map<string, AgencyDisclosure>> {
    const ids = [...new Set(agencyIds)];
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.agency.findMany({
      where: { id: { in: ids }, status: AgencyStatus.APPROVED, deletedAt: null },
      select: disclosureSelect,
    });
    return new Map(rows.map((r) => [r.id, toAgencyDisclosure(r)]));
  }

  /**
   * Records a warning (e.g. a resolved 허위매물 report) and bumps the denormalized counter.
   * Pass `tx` to join the caller's transaction (the caller writes the audit log).
   */
  async recordWarning(
    input: { agencyId: string; reason: string; reportId?: string | null; adminId?: string | null },
    tx?: PrismaTx,
  ): Promise<{ id: string }> {
    const run = async (db: PrismaTx) => {
      const agency = await db.agency.findFirst({
        where: { id: input.agencyId, deletedAt: null },
        select: { id: true, ownerUserId: true },
      });
      if (!agency) throw AppException.notFound(ErrorCode.AGENCY_NOT_FOUND);
      const warning = await db.agencyWarning.create({
        data: {
          agencyId: agency.id,
          reason: input.reason,
          reportId: input.reportId ?? null,
          adminId: input.adminId ?? null,
        },
        select: { id: true },
      });
      await db.agency.update({
        where: { id: agency.id },
        data: { warningCount: { increment: 1 } },
      });
      await db.notification.create({
        data: {
          userId: agency.ownerUserId,
          type: NotificationType.AGENCY_WARNED,
          title: '중개사무소 경고 안내',
          body: input.reason.slice(0, 1000),
          data: { agencyId: agency.id, warningId: warning.id },
        },
      });
      return warning;
    };
    const warning = tx ? await run(tx) : await this.prisma.$transaction(run);
    await this.cache.invalidatePublic();
    return warning;
  }
}
