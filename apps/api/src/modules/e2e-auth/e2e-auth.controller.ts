import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator';
import { SkipTermsCheck } from '../auth/terms/skip-terms-check.decorator';
import { E2eLoginDto, type E2eLoginResponse } from './e2e-auth.dto';
import { E2eOnlyGuard } from './e2e-auth.guard';
import { E2eAuthService } from './e2e-auth.service';

/**
 * TEST-ONLY login for the browser e2e harness (`POST /api/v1/e2e/login`). Registered only when
 * NODE_ENV=test and E2E_FAKE_OAUTH=1 (see e2e-auth.enabled.ts); 404 otherwise.
 * CSRF is skipped because the test runner calls it from a fresh API request context (no page,
 * no Origin); it can only ever exist on a NODE_ENV=test server.
 */
@ApiExcludeController()
@Controller('e2e')
@UseGuards(E2eOnlyGuard)
@Public()
@SkipCsrf()
@SkipTermsCheck()
export class E2eAuthController {
  constructor(private readonly service: E2eAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() dto: E2eLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<E2eLoginResponse> {
    return this.service.login(dto, req, res);
  }
}
