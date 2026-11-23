import {
  ErrorCode,
  maskEmail,
  maskPhone,
  type MemberDetail,
  type MemberListItem,
  type MemberListQuery,
  type MemberSuspendInput,
  normalizePhone,
  type Paginated,
  UserStatus,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../../../common/audit/audit.service';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { SessionService } from '../../auth';

const listSelect = {
  id: true,
  nickname: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
  lastLoginAt: true,
  identities: { select: { provider: true } },
} satisfies Prisma.UserSelect;

const detailSelect = {
  id: true,
  nickname: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
  lastLoginAt: true,
  marketingOptIn: true,
  suspendedAt: true,
  suspendedReason: true,
  withdrawnAt: true,
  withdrawalReason: true,
  piiScrubbedAt: true,
  identities: {
    select: { provider: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: 'asc' },
  },
  agencyMemberships: {
    select: {
      agencyId: true,
      role: true,
      status: true,
      agency: { select: { name: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
  _count: { select: { dealRequests: true, reports: true, favoriteListings: true } },
} satisfies Prisma.UserSelect;

/** What a member status change records in the audit log. */
const auditSelect = {
  id: true,
  status: true,
  suspendedAt: true,
  suspendedReason: true,
} satisfies Prisma.UserSelect;

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** "010-1234" / "5678" → digit search on the phone column; anything else → text search. */
function memberSearch(q: string): Prisma.UserWhereInput {
  const digits = normalizePhone(q);
  const or: Prisma.UserWhereInput[] = [
    { nickname: { contains: q, mode: 'insensitive' } },
    { name: { contains: q, mode: 'insensitive' } },
    { email: { contains: q, mode: 'insensitive' } },
  ];
  if (/^[\d\s+()-]+$/.test(q) && digits.length >= 4) or.push({ phone: { contains: digits } });
  return { OR: or };
}

/** Member (site user) search, detail and suspension. */
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  async list(q: MemberListQuery): Promise<Paginated<MemberListItem>> {
    const where: Prisma.UserWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.role ? { role: q.role } : {}),
      ...(q.q ? memberSearch(q.q) : {}),
    };
    const page = await paginate(
      q,
      (args) =>
        this.prisma.user.findMany({
          where,
          select: listSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
      () => this.prisma.user.count({ where }),
    );
    return {
      ...page,
      items: page.items.map((u) => ({
        id: u.id,
        nickname: u.nickname,
        name: u.name,
        email: maskEmail(u.email),
        phone: u.phone ? maskPhone(u.phone) : null,
        role: u.role,
        status: u.status,
        providers: u.identities.map((i) => i.provider),
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: iso(u.lastLoginAt),
      })),
    };
  }

  /**
   * Full member record, contacts unmasked. Viewing it is a 개인정보 접속기록 (안전성 확보조치 기준
   * 제8조: who, when, whose data, what), so it writes a `member.pii-view` audit row. The row names
   * the fields shown, never their values.
   */
  async detail(id: string): Promise<MemberDetail> {
    const detail = await this.build(id);
    await this.audit.record({
      action: 'member.pii-view',
      resourceType: 'User',
      resourceId: id,
      after: { fields: ['name', 'email', 'phone'] },
    });
    return detail;
  }

  private async build(id: string): Promise<MemberDetail> {
    const u = await this.prisma.user.findUnique({ where: { id }, select: detailSelect });
    if (!u) throw AppException.notFound(ErrorCode.MEMBER_NOT_FOUND);
    const sessions = await this.sessions.listForSubject('USER', id);
    return {
      id: u.id,
      nickname: u.nickname,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: iso(u.lastLoginAt),
      marketingOptIn: u.marketingOptIn,
      suspendedAt: iso(u.suspendedAt),
      suspendedReason: u.suspendedReason,
      withdrawnAt: iso(u.withdrawnAt),
      withdrawalReason: u.withdrawalReason,
      piiScrubbedAt: iso(u.piiScrubbedAt),
      identities: u.identities.map((i) => ({
        provider: i.provider,
        createdAt: i.createdAt.toISOString(),
        lastUsedAt: iso(i.lastUsedAt),
      })),
      memberships: u.agencyMemberships.map((m) => ({
        agencyId: m.agencyId,
        agencyName: m.agency.name,
        agencyStatus: m.agency.status,
        role: m.role,
        status: m.status,
      })),
      counts: {
        dealRequests: u._count.dealRequests,
        reports: u._count.reports,
        favoriteListings: u._count.favoriteListings,
      },
      activeSessions: sessions.length,
    };
  }

  /** ACTIVE → SUSPENDED and logout everywhere (OAuth login is refused while suspended). */
  async suspend(id: string, dto: MemberSuspendInput): Promise<MemberDetail> {
    await this.transition(id, 'member.suspend', UserStatus.ACTIVE, {
      status: UserStatus.SUSPENDED,
      suspendedAt: new Date(),
      suspendedReason: dto.reason,
    });
    await this.sessions.destroyAllForSubject('USER', id);
    return this.maskedDetail(id);
  }

  async unsuspend(id: string): Promise<MemberDetail> {
    await this.transition(id, 'member.unsuspend', UserStatus.SUSPENDED, {
      status: UserStatus.ACTIVE,
      suspendedAt: null,
      suspendedReason: null,
    });
    return this.maskedDetail(id);
  }

  /** Mutation responses mask contacts like the list does (the full record is GET /:id). */
  private async maskedDetail(id: string): Promise<MemberDetail> {
    const d = await this.build(id);
    return { ...d, email: maskEmail(d.email), phone: d.phone ? maskPhone(d.phone) : null };
  }

  /**
   * Status change + audit row in one transaction. The audit snapshots are a minimal projection
   * (no name, email, phone or withdrawal reason): audit_logs is append-only and never scrubbed.
   */
  private async transition(
    id: string,
    action: 'member.suspend' | 'member.unsuspend',
    from: UserStatus,
    data: Prisma.UserUpdateManyMutationInput,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findUnique({ where: { id }, select: auditSelect });
      if (!before) throw AppException.notFound(ErrorCode.MEMBER_NOT_FOUND);
      if (before.status !== from) throw AppException.badRequest(ErrorCode.MEMBER_INVALID_STATUS);
      const { count } = await tx.user.updateMany({ where: { id, status: from }, data });
      // Lost a race with another status change (withdrawal, a second operator).
      if (count === 0) throw AppException.conflict(ErrorCode.MEMBER_INVALID_STATUS);
      const after = await tx.user.findUniqueOrThrow({ where: { id }, select: auditSelect });
      await this.audit.record({ action, resourceType: 'User', resourceId: id, before, after }, tx);
    });
  }
}
