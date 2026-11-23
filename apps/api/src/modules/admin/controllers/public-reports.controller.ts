import type { ReportCreatedResponse } from '@house/shared';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { UserPrincipal } from '../../../common/auth/principal';
import { CurrentUser } from '../../../common/decorators';
import { THROTTLE } from '../../../common/throttle/throttle.constants';
import { ReportCreateDto } from '../dto';
import { ReportsService } from '../services/reports.service';

/** 허위매물 신고 (login required; per-IP throttle + per-user daily cap). */
@ApiTags('reports')
@Controller('reports')
export class PublicReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @Throttle(THROTTLE.REPORT)
  create(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: ReportCreateDto,
  ): Promise<ReportCreatedResponse> {
    return this.reports.create(user, dto);
  }
}
