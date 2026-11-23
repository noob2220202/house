import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  AUTH_PROVIDER_LABEL,
  AUTH_PROVIDER_SLUG,
  type AuthProvider,
  type CsrfTokenResponse,
  ErrorCode,
  type MeResponse,
  type PendingSignupResponse,
  type SessionSummary,
  type SignupResponse,
} from '@house/shared';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { UserPrincipal } from '../../common/auth/principal';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AppException } from '../../common/errors/app.exception';
import { THROTTLE } from '../../common/throttle/throttle.constants';
import { SessionIdParamDto, SignupDto } from './dto';
import { OAuthProviderRegistry } from './oauth/oauth-registry';
import { randomToken } from './oauth/oauth-state.store';
import { readSessionCookie, SessionService } from './session/session.service';
import { SignupService } from './signup/signup.service';
import { AccountService } from './users/account.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly sessions: SessionService,
    private readonly accounts: AccountService,
    private readonly signup: SignupService,
    private readonly registry: OAuthProviderRegistry,
  ) {}

  /** Enabled social login providers, for the login page. */
  @Public()
  @Get('providers')
  providers(): { provider: AuthProvider; slug: string; label: string }[] {
    return this.registry.enabled().map((p) => ({
      provider: p,
      slug: AUTH_PROVIDER_SLUG[p],
      label: AUTH_PROVIDER_LABEL[p],
    }));
  }

  /**
   * (Re-)issues the CSRF cookie and returns the token. With a session it is the session's token
   * (what CsrfGuard checks); without one a fresh random token is returned (nothing to protect yet).
   * Frontends should prefer the body value over reading the cookie.
   */
  @Public()
  @Get('csrf')
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response): CsrfTokenResponse {
    const csrfToken = req.authSession?.csrfToken ?? randomToken();
    this.sessions.setCsrfCookie(res, csrfToken);
    res.setHeader('Cache-Control', 'no-store');
    return { csrfToken };
  }

  @Get('me')
  me(@CurrentUser() user: UserPrincipal): Promise<MeResponse> {
    return this.accounts.me(user);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() _user: UserPrincipal,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = readSessionCookie(req, 'USER');
    if (token) await this.sessions.destroy(token);
    this.sessions.clearCookies(res, 'USER');
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: UserPrincipal,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ revoked: number }> {
    const revoked = await this.sessions.destroyAllForSubject('USER', user.userId);
    this.sessions.clearCookies(res, 'USER');
    return { revoked };
  }

  /** Logged-in devices of the current user. */
  @Get('sessions')
  async listSessions(@CurrentUser() user: UserPrincipal): Promise<SessionSummary[]> {
    const records = await this.sessions.listForSubject('USER', user.userId);
    return records.map((r) => ({
      id: r.id,
      current: r.id === user.sessionId,
      createdAt: new Date(r.createdAt).toISOString(),
      lastSeenAt: new Date(r.lastSeenAt).toISOString(),
      ip: r.ip,
      userAgent: r.userAgent,
    }));
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(THROTTLE.WRITE)
  async revokeSession(
    @CurrentUser() user: UserPrincipal,
    @Param() params: SessionIdParamDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const ok = await this.sessions.destroyForSubject('USER', user.userId, params.id);
    if (!ok) throw AppException.notFound(ErrorCode.AUTH_SESSION_NOT_FOUND);
    if (params.id === user.sessionId) this.sessions.clearCookies(res, 'USER');
  }

  /** Pending social signup (after the first OAuth callback): profile prefill + current terms. */
  @Public()
  @Get('signup')
  @Throttle(THROTTLE.AUTH)
  pendingSignup(@Req() req: Request): Promise<PendingSignupResponse> {
    return this.signup.describe(req);
  }

  @Public()
  @Post('signup')
  @Throttle(THROTTLE.AUTH)
  completeSignup(
    @Body() dto: SignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignupResponse> {
    return this.signup.complete(req, res, dto);
  }
}
