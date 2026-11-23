import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type {
  AdminLoginResponse,
  AdminMeResponse,
  AdminSessionResponse,
  AdminTotpActivateResponse,
  AdminTotpSetupResponse,
  CsrfTokenResponse,
} from '@house/shared';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { CurrentAdmin } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { AppException } from '../../../common/errors/app.exception';
import { THROTTLE } from '../../../common/throttle/throttle.constants';
import {
  AdminLoginDto,
  AdminPasswordChangeDto,
  AdminTotpActivateDto,
  AdminTotpVerifyDto,
} from '../dto';
import { SessionService } from '../session/session.service';
import { AdminAuthService } from './admin-auth.service';

/**
 * Back-office authentication. `@Public()` here only means "the global guard doesn't demand a
 * TOTP-verified session": the TOTP endpoints still require the pre-MFA admin session from login
 * (@CurrentAdmin → 401 without one).
 */
@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE.ADMIN_LOGIN)
  login(
    @Body() dto: AdminLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminLoginResponse> {
    return this.auth.login(dto, req, res);
  }

  @Public()
  @Get('csrf')
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response): CsrfTokenResponse {
    const session = req.authSession;
    if (!session || session.principal.kind !== 'ADMIN') throw AppException.unauthenticated();
    this.sessions.setCsrfCookie(res, session.csrfToken);
    res.setHeader('Cache-Control', 'no-store');
    return { csrfToken: session.csrfToken };
  }

  /** Starts TOTP enrollment (first login) or rotation (from a verified session). */
  @Public()
  @Post('totp/setup')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE.ADMIN_LOGIN)
  setup(@CurrentAdmin() admin: AdminPrincipal): Promise<AdminTotpSetupResponse> {
    return this.auth.setupTotp(admin);
  }

  @Public()
  @Post('totp/activate')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE.ADMIN_LOGIN)
  activate(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() dto: AdminTotpActivateDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminTotpActivateResponse> {
    return this.auth.activateTotp(admin, dto.code, req, res);
  }

  @Public()
  @Post('totp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE.ADMIN_LOGIN)
  verify(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() dto: AdminTotpVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminSessionResponse> {
    return this.auth.verifyTotp(admin, dto, req, res);
  }

  @Get('me')
  me(@CurrentAdmin() admin: AdminPrincipal): Promise<AdminMeResponse> {
    return this.auth.me(admin);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentAdmin() _admin: AdminPrincipal,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(req, res);
  }

  @Post('password')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE.ADMIN_LOGIN)
  changePassword(
    @CurrentAdmin() admin: AdminPrincipal,
    @Body() dto: AdminPasswordChangeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminSessionResponse> {
    return this.auth.changePassword(admin, dto, req, res);
  }
}
