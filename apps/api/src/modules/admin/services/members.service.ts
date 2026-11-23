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
import { RequestContext } from '../../../common/context/request-context';
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

  async detail(id: string): Promise<MemberDetail> {
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
    await this.transition(id, UserStatus.ACTIVE, {
      status: UserStatus.SUSPENDED,
      suspendedAt: new Date(),
      suspendedReason: dto.reason,
    });
    await this.sessions.destroyAllForSubject('USER', id);
    return this.detail(id);
  }

  async unsuspend(id: string): Promise<MemberDetail> {
    await this.transition(id, UserStatus.SUSPENDED, {
      status: UserStatus.ACTIVE,
      suspendedAt: null,
      suspendedReason: null,
    });
    return this.detail(id);
  }

  private async transition(
    id: string,
    from: UserStatus,
    data: Prisma.UserUpdateManyMutationInput,
  ): Promise<void> {
    const before = await this.detail(id);
    if (before.status !== from) throw AppException.badRequest(ErrorCode.MEMBER_INVALID_STATUS);
    RequestContext.setAuditBefore(before);
    const { count } = await this.prisma.user.updateMany({ where: { id, status: from }, data });
    // Lost a race with another status change (withdrawal, a second operator).
    if (count === 0) throw AppException.conflict(ErrorCode.MEMBER_INVALID_STATUS);
  }
}
