import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { THROTTLE } from '../../../common/throttle/throttle.constants';
import { OAuthCallbackQueryDto, OAuthProviderParamDto, OAuthStartQueryDto } from '../dto';
import { OAuthService } from './oauth.service';

/**
 * Fixed routes (registered in the Kakao / Naver / Google consoles):
 *   GET /api/v1/auth/oauth/{kakao|naver|google}/start
 *   GET /api/v1/auth/oauth/{kakao|naver|google}/callback
 */
@ApiTags('auth')
@Controller('auth/oauth')
@Public()
@Throttle(THROTTLE.AUTH)
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  @Get(':provider/start')
  async start(
    @Param() params: OAuthProviderParamDto,
    @Query() query: OAuthStartQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.oauth.start(params.provider, query, req, res);
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, url);
  }

  @Get(':provider/callback')
  async callback(
    @Param() params: OAuthProviderParamDto,
    @Query() query: OAuthCallbackQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.oauth.callback(params.provider, query, req, res);
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, url);
  }
}
