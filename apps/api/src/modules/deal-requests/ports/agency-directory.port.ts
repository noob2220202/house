import { AgencyMemberStatus, AgencyStatus, UserStatus } from '@house/shared';
import { Injectable } from '@nestjs/common';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { JOB_BATCH_SIZE } from '../constants';

/**
 * Agency reads the deal-requests module needs beyond AgenciesService (membership + disclosure):
 * an agency's 시군구, approval of target ids, names and notification recipients. The agencies
 * module exposes no service for these yet, so this binding reads its tables read-only; swap it for
 * AgenciesService methods once they exist.
 */
export interface DealRequestAgencyDirectory {
  /** 시군구 of an APPROVED, non-deleted agency (null otherwise). */
  approvedSggCode(agencyId: string): Promise<string | null>;
  /** The subset of `ids` that are APPROVED and not deleted. */
  approvedIds(ids: readonly string[], db?: PrismaTx): Promise<Set<string>>;
  names(ids: readonly string[]): Promise<Map<string, string>>;
  /** Active users of ACTIVE memberships of the given agencies. */
  memberUserIds(agencyIds: readonly string[], db?: PrismaTx): Promise<string[]>;
  /**
   * Active users of ACTIVE memberships of APPROVED agencies in `sggCode`, keyset-paginated by
   * membership id (pass the last id back as `after`).
   */
  regionMemberBatch(
    sggCode: string,
    after: string | null,
    db?: PrismaTx,
  ): Promise<{ userIds: string[]; last: string | null }>;
}

export const DEAL_REQUEST_AGENCIES = Symbol('DEAL_REQUEST_AGENCIES');

@Injectable()
export class PrismaDealRequestAgencyDirectory implements DealRequestAgencyDirectory {
  constructor(private readonly prisma: PrismaService) {}

  async approvedSggCode(agencyId: string): Promise<string | null> {
    const row = await this.prisma.agency.findFirst({
      where: { id: agencyId, status: AgencyStatus.APPROVED, deletedAt: null },
      select: { sggCode: true },
    });
    return row?.sggCode ?? null;
  }

  async approvedIds(ids: readonly string[], db: PrismaTx = this.prisma): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const rows = await db.agency.findMany({
      where: { id: { in: [...ids] }, status: AgencyStatus.APPROVED, deletedAt: null },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }

  async names(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.agency.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  async memberUserIds(agencyIds: readonly string[], db: PrismaTx = this.prisma): Promise<string[]> {
    if (agencyIds.length === 0) return [];
    const rows = await db.agencyMember.findMany({
      where: {
        agencyId: { in: [...agencyIds] },
        status: AgencyMemberStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
      },
      select: { userId: true },
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  async regionMemberBatch(
    sggCode: string,
    after: string | null,
    db: PrismaTx = this.prisma,
  ): Promise<{ userIds: string[]; last: string | null }> {
    const rows = await db.agencyMember.findMany({
      where: {
        status: AgencyMemberStatus.ACTIVE,
        user: { status: UserStatus.ACTIVE },
        agency: { status: AgencyStatus.APPROVED, deletedAt: null, sggCode },
        ...(after ? { id: { gt: after } } : {}),
      },
      select: { id: true, userId: true },
      orderBy: { id: 'asc' },
      take: JOB_BATCH_SIZE,
    });
    return {
      userIds: rows.map((r) => r.userId),
      last: rows.length === JOB_BATCH_SIZE ? (rows[rows.length - 1]?.id ?? null) : null,
    };
  }
}
