import {
  AgencyMemberRole,
  AgencyMemberStatus,
  AgencyStatus,
  ErrorCode,
  LIVE_AGENCY_STATUSES,
  UserRole,
  type AgencyInviteCreateInput,
  type AgencyInviteView,
  type AgencyJoinInput,
  type AgencyMemberUpdateInput,
  type AgencyMemberView,
  type MyAgencyMembership,
  type Paginated,
  type PaginationQuery,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { toMemberView } from '../agency.mapper';
import { agencyMemberSelect } from '../agency.selects';
import { MAX_ACTIVE_INVITES } from '../constants';
import { lockUserMembership } from '../domain/locks';
import { AgencyCacheService } from './agency-cache.service';
import { AgencyInviteStore, toInviteView } from './agency-invite.store';
import { AgencySessionSyncService } from './agency-session-sync.service';

const liveMembershipWhere = (userId: string) => ({
  userId,
  status: AgencyMemberStatus.ACTIVE,
  agency: { deletedAt: null, status: { in: [...LIVE_AGENCY_STATUSES] } },
});

/**
 * 소속 중개사 관리: the owner issues single-use invite codes, a user redeems one to join as AGENT,
 * the owner edits / removes staff, an agent may leave. Removing or leaving downgrades the user to
 * USER and updates live sessions.
 */
@Injectable()
export class AgencyMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invites: AgencyInviteStore,
    private readonly cache: AgencyCacheService,
    private readonly sessions: AgencySessionSyncService,
  ) {}

  async list(
    user: UserPrincipal,
    q: PaginationQuery & { includeRemoved: boolean },
  ): Promise<Paginated<AgencyMemberView>> {
    const agencyId = await this.managedAgencyId(user.userId);
    const where = {
      agencyId,
      ...(q.includeRemoved ? {} : { status: AgencyMemberStatus.ACTIVE }),
    };
    const page = await paginate(
      q,
      (args) =>
        this.prisma.agencyMember.findMany({
          where,
          select: agencyMemberSelect,
          // OWNER sorts before AGENT (enum order), then by join date.
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }, { id: 'asc' }],
          ...args,
        }),
      () => this.prisma.agencyMember.count({ where }),
    );
    return { ...page, items: page.items.map(toMemberView) };
  }

  async update(
    user: UserPrincipal,
    memberId: string,
    input: AgencyMemberUpdateInput,
  ): Promise<AgencyMemberView> {
    const agencyId = await this.managedAgencyId(user.userId);
    const member = await this.findMember(agencyId, memberId);
    const isLicensed = input.isLicensed ?? member.isLicensed;
    const updated = await this.prisma.agencyMember.update({
      where: { id: member.id },
      data: {
        displayName: input.displayName,
        title: input.title,
        phone: input.phone,
        isLicensed: input.isLicensed,
        // A 중개보조원 has no license number.
        licenseNumber: isLicensed ? input.licenseNumber : null,
      },
      select: agencyMemberSelect,
    });
    await this.cache.invalidatePublic();
    return toMemberView(updated);
  }

  async remove(user: UserPrincipal, memberId: string): Promise<void> {
    const agencyId = await this.managedAgencyId(user.userId);
    const member = await this.findMember(agencyId, memberId);
    if (member.role === AgencyMemberRole.OWNER) {
      throw AppException.badRequest(ErrorCode.AGENCY_OWNER_NOT_REMOVABLE);
    }
    await this.prisma.$transaction(async (tx) => {
      await lockUserMembership(tx, member.userId);
      await this.deactivate(tx, member.id, member.userId);
    });
    await this.sessions.apply(member.userId, { role: UserRole.USER, agencyId: null });
    await this.cache.invalidatePublic();
  }

  /** The caller's own live membership (owner or agent), or 404. */
  async myMembership(user: UserPrincipal): Promise<MyAgencyMembership> {
    const m = await this.prisma.agencyMember.findFirst({
      where: liveMembershipWhere(user.userId),
      orderBy: { joinedAt: 'asc' },
      select: {
        id: true,
        role: true,
        displayName: true,
        agency: {
          select: { id: true, name: true, phone: true, roadAddress: true, status: true },
        },
      },
    });
    if (!m) throw AppException.notFound(ErrorCode.AGENCY_MEMBER_NOT_FOUND);
    return { memberId: m.id, role: m.role, displayName: m.displayName, agency: m.agency };
  }

  /** An AGENT leaves their agency. Owners cannot leave (the agency would be ownerless). */
  async leave(user: UserPrincipal): Promise<void> {
    const m = await this.prisma.agencyMember.findFirst({
      where: liveMembershipWhere(user.userId),
      select: { id: true, role: true },
    });
    if (!m) throw AppException.notFound(ErrorCode.AGENCY_MEMBER_NOT_FOUND);
    if (m.role === AgencyMemberRole.OWNER) {
      throw AppException.badRequest(ErrorCode.AGENCY_OWNER_NOT_REMOVABLE);
    }
    await this.prisma.$transaction(async (tx) => {
      await lockUserMembership(tx, user.userId);
      await this.deactivate(tx, m.id, user.userId);
    });
    await this.sessions.apply(user.userId, { role: UserRole.USER, agencyId: null });
    await this.cache.invalidatePublic();
  }

  // ---------- invites ----------

  async createInvite(
    user: UserPrincipal,
    input: AgencyInviteCreateInput,
  ): Promise<AgencyInviteView> {
    const agencyId = await this.managedAgencyId(user.userId);
    if ((await this.invites.countForAgency(agencyId)) >= MAX_ACTIVE_INVITES) {
      throw AppException.badRequest(ErrorCode.AGENCY_INVITE_LIMIT, { max: MAX_ACTIVE_INVITES });
    }
    const { record, code } = await this.invites.create({
      agencyId,
      createdByUserId: user.userId,
      label: input.label ?? null,
      ttlSeconds: input.expiresInHours * 3600,
    });
    return toInviteView(record, code);
  }

  async listInvites(user: UserPrincipal): Promise<AgencyInviteView[]> {
    const agencyId = await this.managedAgencyId(user.userId);
    return (await this.invites.listForAgency(agencyId)).map((r) => toInviteView(r));
  }

  async revokeInvite(user: UserPrincipal, inviteId: string): Promise<void> {
    const agencyId = await this.managedAgencyId(user.userId);
    if (!(await this.invites.revoke(agencyId, inviteId))) {
      throw AppException.notFound(ErrorCode.AGENCY_INVITE_NOT_FOUND);
    }
  }

  /** Redeems an invite code: the user becomes an ACTIVE AGENT of the inviting (APPROVED) agency. */
  async join(user: UserPrincipal, input: AgencyJoinInput): Promise<MyAgencyMembership> {
    const peeked = await this.invites.peek(input.code);
    if (!peeked) throw AppException.badRequest(ErrorCode.AGENCY_INVITE_INVALID);
    // Eligibility is checked before the code is claimed so a refused join does not burn it.
    await this.assertCanJoin(this.prisma, user.userId, peeked.agencyId);

    const claimed = await this.invites.consume(input.code);
    if (!claimed) throw AppException.badRequest(ErrorCode.AGENCY_INVITE_INVALID);
    try {
      await this.prisma.$transaction(async (tx) => {
        await lockUserMembership(tx, user.userId);
        await this.assertCanJoin(tx, user.userId, claimed.agencyId);
        const data = {
          role: AgencyMemberRole.AGENT,
          status: AgencyMemberStatus.ACTIVE,
          displayName: input.displayName,
          title: input.title ?? null,
          phone: input.phone ?? null,
          isLicensed: input.isLicensed,
          licenseNumber: input.isLicensed ? (input.licenseNumber ?? null) : null,
        };
        await tx.agencyMember.upsert({
          where: { agencyId_userId: { agencyId: claimed.agencyId, userId: user.userId } },
          create: { agencyId: claimed.agencyId, userId: user.userId, ...data },
          update: { ...data, joinedAt: new Date(), removedAt: null },
        });
        await tx.user.update({ where: { id: user.userId }, data: { role: UserRole.AGENT } });
      });
    } catch (err) {
      await this.invites.restore(claimed);
      throw err;
    }
    await this.sessions.apply(user.userId, { role: UserRole.AGENT, agencyId: claimed.agencyId });
    await this.cache.invalidatePublic();
    return this.myMembership({ ...user, role: UserRole.AGENT, agencyId: claimed.agencyId });
  }

  // ---------- internals ----------

  /** The APPROVED agency the user owns (staff can be managed only after approval). */
  private async managedAgencyId(userId: string): Promise<string> {
    const agency = await this.prisma.agency.findFirst({
      where: { ownerUserId: userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    });
    if (!agency) throw AppException.notFound(ErrorCode.AGENCY_NOT_FOUND);
    if (agency.status !== AgencyStatus.APPROVED) {
      throw AppException.forbidden(ErrorCode.AGENCY_NOT_APPROVED);
    }
    return agency.id;
  }

  private async findMember(agencyId: string, memberId: string) {
    const member = await this.prisma.agencyMember.findFirst({
      where: { id: memberId, agencyId, status: AgencyMemberStatus.ACTIVE },
      select: { id: true, userId: true, role: true, isLicensed: true },
    });
    if (!member) throw AppException.notFound(ErrorCode.AGENCY_MEMBER_NOT_FOUND);
    return member;
  }

  private async assertCanJoin(db: PrismaTx, userId: string, agencyId: string): Promise<void> {
    const agency = await db.agency.findFirst({
      where: { id: agencyId, deletedAt: null, status: AgencyStatus.APPROVED },
      select: { id: true },
    });
    if (!agency) throw AppException.badRequest(ErrorCode.AGENCY_INVITE_INVALID);
    const [owned, member] = await Promise.all([
      db.agency.count({
        where: { ownerUserId: userId, deletedAt: null, status: { in: [...LIVE_AGENCY_STATUSES] } },
      }),
      db.agencyMember.count({ where: liveMembershipWhere(userId) }),
    ]);
    if (owned > 0 || member > 0) throw AppException.conflict(ErrorCode.AGENCY_ALREADY_MEMBER);
  }

  private async deactivate(tx: PrismaTx, memberId: string, userId: string): Promise<void> {
    await tx.agencyMember.update({
      where: { id: memberId },
      data: { status: AgencyMemberStatus.REMOVED, removedAt: new Date() },
    });
    await tx.user.updateMany({
      where: { id: userId, role: UserRole.AGENT },
      data: { role: UserRole.USER },
    });
  }
}
