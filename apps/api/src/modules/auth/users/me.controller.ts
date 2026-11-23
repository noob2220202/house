import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Res } from '@nestjs/common';
import type { ConsentStatus, IdentitySummary, MeResponse } from '@house/shared';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { UserPrincipal } from '../../../common/auth/principal';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { THROTTLE } from '../../../common/throttle/throttle.constants';
import { ConsentInputDto, OAuthProviderParamDto, UpdateProfileDto, WithdrawDto } from '../dto';
import { AccountService } from './account.service';

/** The member's own account. Linking a provider starts at GET /auth/oauth/:provider/start?intent=link. */
@ApiTags('auth')
@Controller('me')
export class MeController {
  constructor(private readonly accounts: AccountService) {}

  @Patch('profile')
  @Throttle(THROTTLE.WRITE)
  updateProfile(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: UpdateProfileDto,
  ): Promise<MeResponse> {
    return this.accounts.updateProfile(user, dto);
  }

  @Get('identities')
  identities(@CurrentUser() user: UserPrincipal): Promise<IdentitySummary[]> {
    return this.accounts.identities(user);
  }

  @Delete('identities/:provider')
  @Throttle(THROTTLE.WRITE)
  unlink(
    @CurrentUser() user: UserPrincipal,
    @Param() params: OAuthProviderParamDto,
  ): Promise<IdentitySummary[]> {
    return this.accounts.unlink(user, params.provider);
  }

  @Get('consents')
  consents(@CurrentUser() user: UserPrincipal): Promise<ConsentStatus[]> {
    return this.accounts.consents(user);
  }

  @Post('consents')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE.WRITE)
  updateConsents(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: ConsentInputDto,
  ): Promise<ConsentStatus[]> {
    return this.accounts.updateConsents(user, dto);
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(THROTTLE.AUTH)
  withdraw(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: WithdrawDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    return this.accounts.withdraw(user, dto, res);
  }
}
