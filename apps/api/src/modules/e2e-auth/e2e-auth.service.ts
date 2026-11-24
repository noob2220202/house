import { createHash } from 'node:crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AuthProvider, ErrorCode, UserRole, UserStatus } from '@house/shared';
import type { Request, Response } from 'express';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { TermsService } from '../auth/terms/terms.service';
import { UserSessionService } from '../auth/users/user-session.service';
import type { E2eLoginInput, E2eLoginResponse } from './e2e-auth.dto';

/**
 * Test-only stand-in for the social login callback: finds (or creates) a member and starts the
 * session through the same UserSessionService.start the real OAuth callback / signup use, so
 * cookies, CSRF token, acting agency and lastLoginAt behave exactly like production.
 */
@Injectable()
export class E2eAuthService {
  private readonly logger = new Logger(E2eAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly terms: TermsService,
    private readonly userSessions: UserSessionService,
  ) {}

  async login(dto: E2eLoginInput, req: Request, res: Response): Promise<E2eLoginResponse> {
    let created = false;
    let user = await this.prisma.user.findFirst({
      where: { email: dto.email },
      select: { id: true, role: true, status: true },
    });
    if (!user) {
      if (!dto.create) {
        throw new AppException(ErrorCode.NOT_FOUND, {
          status: HttpStatus.NOT_FOUND,
          message: `e2e login: no member with email ${dto.email}`,
        });
      }
      user = await this.createMember(dto.email, dto.create.nickname);
      created = true;
    }
    // Same refusal as the OAuth callback: only ACTIVE members get a session.
    if (user.status !== UserStatus.ACTIVE) {
      throw AppException.forbidden(
        user.status === UserStatus.SUSPENDED
          ? ErrorCode.AUTH_ACCOUNT_SUSPENDED
          : ErrorCode.AUTH_ACCOUNT_WITHDRAWN,
      );
    }
    if (dto.agreeTerms) await this.agreeRequiredTerms(user.id);

    const record = await this.userSessions.start(req, res, user);
    this.logger.warn({ userId: user.id, created }, 'e2e login (test-only)');
    return {
      userId: user.id,
      role: user.role,
      agencyId: record.agencyId,
      created,
      csrfToken: record.csrfToken,
    };
  }

  /** A member as signup creates one: USER role, 만 14세 확인, one (fake) Kakao identity. */
  private createMember(email: string, nickname: string) {
    const providerUserId = `e2e-${createHash('sha256').update(email).digest('hex').slice(0, 24)}`;
    return this.prisma.user.create({
      data: {
        email,
        nickname,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        ageConfirmedAt: new Date(),
        identities: {
          create: {
            provider: AuthProvider.KAKAO,
            providerUserId,
            email,
            emailVerified: true,
            profile: { nickname, name: null, profileImageUrl: null },
            lastUsedAt: new Date(),
          },
        },
      },
      select: { id: true, role: true, status: true },
    });
  }

  private async agreeRequiredTerms(userId: string): Promise<void> {
    const required = (await this.terms.current()).filter((d) => d.isRequired);
    const missing = new Set(await this.terms.pendingRequired(userId, required));
    const decisions = required
      .filter((d) => missing.has(d.type))
      .map((d) => ({ termsDocumentId: d.id, agreed: true }));
    if (decisions.length > 0) await this.terms.record(this.prisma, userId, decisions);
  }
}
