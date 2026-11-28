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
import type { Request, Response } from 'express';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { DealRequestMaintenanceService } from '../../deal-requests/services/deal-request-maintenance.service';
import { InquiryRetentionService } from '../../inquiries/services/inquiry-retention.service';
import { ListingsModerationService } from '../../listings/services/listings-moderation.service';
import {
  AUTH_COOKIE_PATHS,
  AUTH_COOKIES,
  PII_SCRUB_DELAY_DAYS,
  SUSPENDED_PII_RETENTION_DAYS,
} from '../auth.constants';
import { SessionService } from '../session/session.service';
import { TermsService } from '../terms/terms.service';
import { SuspendedWithdrawStore } from './suspended-withdraw.store';
import { type ActiveMembership, UserSessionService } from './user-session.service';
import { WithdrawnIdentityService } from './withdrawn-identity.service';

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
    marketingOptInAt:
      user.marketingOptIn && user.marketingOptInAt ? user.marketingOptInAt.toISOString() : null,
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

/**
 * Opt-in flag + the start of the current opt-in: set when the member opts in from opted-out,
 * kept while they stay opted in (re-saving does not move it), cleared when they opt out.
 */
async function marketingOptInData(
  tx: PrismaTx,
  userId: string,
  optIn: boolean,
): Promise<{ marketingOptIn: boolean; marketingOptInAt?: Date | null }> {
  if (!optIn) return { marketingOptIn: false, marketingOptInAt: null };
  const current = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { marketingOptIn: true, marketingOptInAt: true },
  });
  return current.marketingOptIn && current.marketingOptInAt
    ? { marketingOptIn: true }
    : { marketingOptIn: true, marketingOptInAt: new Date() };
}

/** The logged-in member's own account: profile, identities, consents, withdrawal. */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly userSessions: UserSessionService,
    private readonly terms: TermsService,
    private readonly withdrawn: WithdrawnIdentityService,
    private readonly dealRequests: DealRequestMaintenanceService,
    private readonly listings: ListingsModerationService,
    private readonly suspendedWithdraw: SuspendedWithdrawStore,
    private readonly inquiries: InquiryRetentionService,
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
          ...(dto.marketingOptIn !== undefined
            ? await marketingOptInData(tx, principal.userId, dto.marketingOptIn)
            : {}),
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
          data: await marketingOptInData(tx, principal.userId, marketing.agreed),
        });
      }
    });
    return this.terms.status(principal.userId);
  }

  /**
   * 회원 탈퇴 from a logged-in session: see withdrawUser. Logs out everywhere afterwards.
   */
  async withdraw(principal: UserPrincipal, dto: WithdrawInput, res: Response): Promise<void> {
    await this.withdrawUser(principal.userId, dto);
    this.sessions.clearCookies(res, 'USER');
  }

  /**
   * 회원 탈퇴: soft delete now (status, sessions, identities, agency memberships), PII scrubbed by
   * the PII scrub job after PII_SCRUB_DELAY_DAYS. Identities are removed at once, but a tombstone
   * keeps the same social account from signing up again for REJOIN_COOLDOWN_DAYS. 내놓기/구하기
   * requests are cancelled and erased (contact, 동·호, address, position, photos) in the same
   * transaction by the deal-requests module, so no agency can reveal them after this point;
   * agencies with live proposals are notified after commit.
   * A suspended member may withdraw too (deletion / 처리정지 rights are not suspended): their PII is
   * then kept for SUSPENDED_PII_RETENTION_DAYS and the rejoin cooldown is as long; reports, audit
   * rows and suspendedReason stay as moderation evidence until the scrub.
   */
  async withdrawUser(userId: string, dto: WithdrawInput): Promise<void> {
    const now = new Date();
    const { notices, relinked } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { status: true },
      });
      if (!user || (user.status !== UserStatus.ACTIVE && user.status !== UserStatus.SUSPENDED)) {
        throw AppException.unauthenticated();
      }
      const retentionDays =
        user.status === UserStatus.SUSPENDED ? SUSPENDED_PII_RETENTION_DAYS : PII_SCRUB_DELAY_DAYS;
      const ownsAgency = await tx.agency.count({
        where: {
          ownerUserId: userId,
          deletedAt: null,
          status: { in: [AgencyStatus.PENDING, AgencyStatus.APPROVED, AgencyStatus.SUSPENDED] },
        },
      });
      if (ownsAgency > 0) throw AppException.conflict(ErrorCode.AUTH_WITHDRAW_AGENCY_OWNER);
      const relinked = await this.detachMemberships(tx, userId, now);
      const identities = await tx.identity.findMany({
        where: { userId },
        select: { provider: true, providerUserId: true },
      });
      await this.withdrawn.record(tx, userId, identities, now, {
        cooldownDays:
          user.status === UserStatus.SUSPENDED ? SUSPENDED_PII_RETENTION_DAYS : undefined,
      });
      await tx.identity.deleteMany({ where: { userId } });
      const dealRequestNotices = await this.dealRequests.scrubUser(userId, now, tx);
      // 문의 (inquiries): the member's name, phone and messages go at once, not at the daily job.
      await this.inquiries.scrubUser(userId, now, tx);
      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.WITHDRAWN,
          withdrawnAt: now,
          withdrawalReason: dto.reason ?? null,
          marketingOptIn: false,
          marketingOptInAt: null,
          piiScrubAfter: new Date(now.getTime() + retentionDays * 86_400_000),
        },
      });
      return { notices: dealRequestNotices, relinked };
    });
    await this.sessions.destroyAllForSubject('USER', userId);
    await this.dealRequests.dispatch(notices);
    if (relinked > 0) await this.listings.invalidateSearch();
  }

  /**
   * Ends every agency membership and takes the member's name/phone off the listing ads they were
   * the contact for (moved to the office's 대표). Returns the number of listing links changed.
   */
  private async detachMemberships(tx: PrismaTx, userId: string, now: Date): Promise<number> {
    const memberships = await tx.agencyMember.findMany({
      where: { userId, status: { not: AgencyMemberStatus.REMOVED } },
      select: { id: true, agencyId: true },
    });
    if (memberships.length === 0) return 0;
    await tx.agencyMember.updateMany({
      where: { id: { in: memberships.map((m) => m.id) } },
      data: { status: AgencyMemberStatus.REMOVED, removedAt: now },
    });
    let relinked = 0;
    for (const m of memberships) {
      relinked += await this.listings.memberDeparted(tx, m.agencyId, m.id);
    }
    return relinked;
  }

  /**
   * POST /auth/withdraw: withdrawal of a suspended member, who has no session. Authenticated by the
   * ticket the refused social login issued (SuspendedWithdrawStore); 401 without a live one.
   * The ticket is spent only on success, so a 409 (still owns an agency) can be retried.
   */
  async withdrawWithTicket(req: Request, res: Response, dto: WithdrawInput): Promise<void> {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const token = cookies?.[AUTH_COOKIES.SUSPENDED_WITHDRAW];
    const userId = await this.suspendedWithdraw.get(token);
    if (!token || !userId) throw AppException.unauthenticated();
    await this.withdrawUser(userId, dto);
    await this.suspendedWithdraw.delete(token);
    res.clearCookie(AUTH_COOKIES.SUSPENDED_WITHDRAW, {
      ...this.sessions.baseCookie(),
      httpOnly: true,
      path: AUTH_COOKIE_PATHS.SUSPENDED_WITHDRAW,
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
