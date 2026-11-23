import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type PendingSignupResponse,
  type SignupInput,
  type SignupResponse,
  TermsType,
  UserRole,
} from '@house/shared';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { AppException } from '../../../common/errors/app.exception';
import { PrismaService } from '../../../prisma/prisma.service';
import { AUTH_COOKIE_PATHS, AUTH_COOKIES } from '../auth.constants';
import { SessionService } from '../session/session.service';
import { type ConsentDecision, TermsService, toTermsSummary } from '../terms/terms.service';
import { AccountService } from '../users/account.service';
import { UserSessionService } from '../users/user-session.service';
import { WithdrawnIdentityService } from '../users/withdrawn-identity.service';
import { type PendingSignup, PendingSignupStore } from './pending-signup.store';

const signupExpired = () =>
  new AppException(ErrorCode.AUTH_SIGNUP_EXPIRED, { status: HttpStatus.UNAUTHORIZED });

/**
 * Second half of a first social login: 만 14세 이상 confirmation (schema-enforced, stored as
 * ageConfirmedAt) + terms consent → User + Identity + consents → session.
 */
@Injectable()
export class SignupService {
  constructor(
    private readonly pending: PendingSignupStore,
    private readonly terms: TermsService,
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly userSessions: UserSessionService,
    private readonly accounts: AccountService,
    private readonly withdrawn: WithdrawnIdentityService,
  ) {}

  /** Prefill for the signup form (the provider profile of this browser's pending signup). */
  async describe(req: Request): Promise<PendingSignupResponse> {
    const { pending } = await this.load(req);
    const p = pending.profile;
    return {
      provider: p.provider,
      prefill: {
        nickname: p.nickname,
        name: p.name,
        email: p.email,
        phone: p.phone,
        profileImageUrl: p.profileImageUrl,
      },
      terms: (await this.terms.current()).map(toTermsSummary),
    };
  }

  async complete(req: Request, res: Response, dto: SignupInput): Promise<SignupResponse> {
    const { token, pending } = await this.load(req);
    const profile = pending.profile;

    const user = await this.prisma
      .$transaction(async (tx) => {
        const now = new Date();
        // Re-checked here: the cooldown may have started after the OAuth callback.
        if (await this.withdrawn.inCooldown(profile, now, tx)) {
          throw AppException.forbidden(ErrorCode.AUTH_REJOIN_COOLDOWN);
        }
        const current = await this.terms.current(now, tx);
        this.terms.validate(current, dto.consents, { requireAll: true });
        const decisions: ConsentDecision[] = [...dto.consents];
        let marketingOptIn = dto.marketingOptIn;
        const marketing = current.find((d) => d.type === TermsType.MARKETING);
        if (marketing) {
          const given = decisions.find((d) => d.termsDocumentId === marketing.id);
          if (given) marketingOptIn = given.agreed;
          else decisions.push({ termsDocumentId: marketing.id, agreed: marketingOptIn });
        }
        const created = await tx.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            nickname: dto.nickname,
            // undefined = keep the provider's number (if granted); null = the user removed it.
            phone: dto.phone === undefined ? profile.phone : dto.phone,
            profileImageUrl: profile.profileImageUrl,
            role: UserRole.USER,
            marketingOptIn,
            ageConfirmedAt: now,
            identities: {
              create: {
                provider: profile.provider,
                providerUserId: profile.providerUserId,
                email: profile.email,
                emailVerified: profile.emailVerified,
                profile: {
                  nickname: profile.nickname,
                  name: profile.name,
                  profileImageUrl: profile.profileImageUrl,
                },
                lastUsedAt: new Date(),
              },
            },
          },
        });
        await this.terms.record(tx, created.id, decisions);
        return created;
      })
      .catch((err: unknown) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw AppException.conflict(ErrorCode.AUTH_IDENTITY_DUPLICATE);
        }
        throw err;
      });

    await this.pending.delete(token);
    res.clearCookie(AUTH_COOKIES.PENDING_SIGNUP, {
      ...this.sessions.baseCookie(),
      path: AUTH_COOKIE_PATHS.PENDING_SIGNUP,
    });
    const record = await this.userSessions.start(req, res, user);
    const me = await this.accounts.me({
      kind: 'USER',
      userId: user.id,
      role: user.role,
      agencyId: record.agencyId,
      sessionId: record.id,
    });
    return { user: me, returnTo: pending.returnTo, csrfToken: record.csrfToken };
  }

  private async load(req: Request): Promise<{ token: string; pending: PendingSignup }> {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const token = cookies?.[AUTH_COOKIES.PENDING_SIGNUP];
    const pending = await this.pending.get(token);
    if (!token || !pending) throw signupExpired();
    return { token, pending };
  }
}
