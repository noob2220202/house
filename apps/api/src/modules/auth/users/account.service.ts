import { Injectable } from '@nestjs/common';
import {
  AgencyMemberStatus,
  AgencyStatus,
  type AuthProvider,
  type ConsentInput,
  type ConsentStatus,
  ErrorCode,
  type IdentitySummary,
  type MeResponse,
  TermsType,
  type UpdateProfileInput,
  UserStatus,
  type WithdrawInput,
} from '@house/shared';
import type { Identity, User } from '@prisma/client';
import type { Response } from 'express';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { PII_SCRUB_DELAY_DAYS } from '../auth.constants';
import { SessionService } from '../session/session.service';
import { TermsService } from '../terms/terms.service';
import { type ActiveMembership, UserSessionService } from './user-session.service';

export function toIdentitySummary(i: Identity): IdentitySummary {
  return {
    provider: i.provider,
    email: i.email,
    linkedAt: i.createdAt.toISOString(),
    lastUsedAt: i.lastUsedAt?.toISOString() ?? null,
  };
}

function toMe(
  user: User & { identities: Identity[] },
  agency: ActiveMembership | null,
  pendingRequiredTerms: TermsType[],
): MeResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    nickname: user.nickname,
    phone: user.phone,
    profileImageUrl: user.profileImageUrl,
    role: user.role,
    status: user.status,
    marketingOptIn: user.marketingOptIn,
    createdAt: user.createdAt.toISOString(),
    identities: user.identities.map(toIdentitySummary),
    agency: agency
      ? {
          agencyId: agency.agencyId,
          agencyName: agency.agencyName,
          agencyStatus: agency.agencyStatus,
          memberRole: agency.memberRole,
        }
      : null,
    pendingRequiredTerms,
  };
}

/** The logged-in member's own account: profile, identities, consents, withdrawal. */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly userSessions: UserSessionService,
    private readonly terms: TermsService,
  ) {}

  /**
   * /me. Also self-heals the session: a deactivated account loses it (401), and role / acting
   * agency changes made elsewhere (agency approval, admin action) are written back to it.
   */
  async me(principal: UserPrincipal): Promise<MeResponse> {
    const user = await this.loadActive(principal);
    const memberships = await this.userSessions.activeMemberships(user.id);
    const agency =
      memberships.find((m) => m.agencyId === principal.agencyId) ?? memberships[0] ?? null;
    const agencyId = agency?.agencyId ?? null;
    if (user.role !== principal.role || agencyId !== principal.agencyId) {
      await this.sessions.updateById(principal.sessionId, { role: user.role, agencyId });
    }
    return toMe(user, agency, await this.terms.pendingRequired(user.id));
  }

  async updateProfile(principal: UserPrincipal, dto: UpdateProfileInput): Promise<MeResponse> {
    await this.loadActive(principal);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: principal.userId },
        data: {
          ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.marketingOptIn !== undefined ? { marketingOptIn: dto.marketingOptIn } : {}),
        },
      });
      if (dto.marketingOptIn !== undefined) {
        // The opt-in flag and the consent history must agree (정보통신망법 수신동의 기록).
        const marketing = (await this.terms.current(new Date(), tx)).find(
          (d) => d.type === TermsType.MARKETING,
        );
        if (marketing) {
          await this.terms.record(tx, principal.userId, [
            { termsDocumentId: marketing.id, agreed: dto.marketingOptIn },
          ]);
        }
      }
    });
    return this.me(principal);
  }

  async identities(principal: UserPrincipal): Promise<IdentitySummary[]> {
    const rows = await this.prisma.identity.findMany({
      where: { userId: principal.userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toIdentitySummary);
  }

  /** Unlinks a provider; the last identity can't go (social login is the only way in). */
  async unlink(principal: UserPrincipal, provider: AuthProvider): Promise<IdentitySummary[]> {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.identity.findMany({
        where: { userId: principal.userId },
        select: { id: true, provider: true },
      });
      const target = rows.find((r) => r.provider === provider);
      if (!target) throw AppException.notFound(ErrorCode.AUTH_IDENTITY_NOT_FOUND);
      if (rows.length <= 1) throw AppException.conflict(ErrorCode.AUTH_LAST_IDENTITY);
      await tx.identity.delete({ where: { id: target.id } });
    });
    return this.identities(principal);
  }

  consents(principal: UserPrincipal): Promise<ConsentStatus[]> {
    return this.terms.status(principal.userId);
  }

  async updateConsents(principal: UserPrincipal, dto: ConsentInput): Promise<ConsentStatus[]> {
    await this.loadActive(principal);
    await this.prisma.$transaction(async (tx) => {
      const current = await this.terms.current(new Date(), tx);
      const byId = this.terms.validate(current, dto.consents, { requireAll: false });
      await this.terms.record(tx, principal.userId, dto.consents);
      const marketing = dto.consents.find(
        (c) => byId.get(c.termsDocumentId)?.type === TermsType.MARKETING,
      );
      if (marketing) {
        await tx.user.update({
          where: { id: principal.userId },
          data: { marketingOptIn: marketing.agreed },
        });
      }
    });
    return this.terms.status(principal.userId);
  }

  /**
   * 회원 탈퇴: soft delete now (status, sessions, identities, agency memberships), PII scrubbed by
   * the PII scrub job after PII_SCRUB_DELAY_DAYS. Identities are removed immediately so the same
   * social account can sign up again as a new member.
   */
  async withdraw(principal: UserPrincipal, dto: WithdrawInput, res: Response): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: principal.userId },
        select: { status: true },
      });
      if (!user || user.status === UserStatus.WITHDRAWN) throw AppException.unauthenticated();
      const ownsAgency = await tx.agency.count({
        where: {
          ownerUserId: principal.userId,
          deletedAt: null,
          status: { in: [AgencyStatus.PENDING, AgencyStatus.APPROVED, AgencyStatus.SUSPENDED] },
        },
      });
      if (ownsAgency > 0) throw AppException.conflict(ErrorCode.AUTH_WITHDRAW_AGENCY_OWNER);
      await this.detachMemberships(tx, principal.userId, now);
      await tx.identity.deleteMany({ where: { userId: principal.userId } });
      await tx.user.update({
        where: { id: principal.userId },
        data: {
          status: UserStatus.WITHDRAWN,
          withdrawnAt: now,
          withdrawalReason: dto.reason ?? null,
          marketingOptIn: false,
          piiScrubAfter: new Date(now.getTime() + PII_SCRUB_DELAY_DAYS * 86_400_000),
        },
      });
    });
    await this.sessions.destroyAllForSubject('USER', principal.userId);
    this.sessions.clearCookies(res, 'USER');
  }

  private async detachMemberships(tx: PrismaTx, userId: string, now: Date): Promise<void> {
    await tx.agencyMember.updateMany({
      where: { userId, status: { not: AgencyMemberStatus.REMOVED } },
      data: { status: AgencyMemberStatus.REMOVED, removedAt: now },
    });
  }

  private async loadActive(principal: UserPrincipal): Promise<User & { identities: Identity[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: principal.userId },
      include: { identities: { orderBy: { createdAt: 'asc' } } },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.sessions.destroyAllForSubject('USER', principal.userId);
      throw AppException.unauthenticated(
        user?.status === UserStatus.SUSPENDED
          ? ErrorCode.AUTH_ACCOUNT_SUSPENDED
          : ErrorCode.UNAUTHENTICATED,
      );
    }
    return user;
  }
}
