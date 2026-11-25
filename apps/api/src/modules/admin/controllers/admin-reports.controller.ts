import type { AdminReportDetailView, AdminReportView, Paginated } from '@house/shared';
import { AdminPermission } from '@house/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { Audit, CurrentAdmin } from '../../../common/decorators';
import { IdParamDto, ReportListQueryDto, ReportResolveDto, ReportReviewDto } from '../dto';
import { RequirePermission } from '../permissions.decorator';
import { ReportsService } from '../services/reports.service';

/** 허위매물 신고 queue. Resolution is audited inside its transaction (ReportsService.resolve). */
@ApiTags('admin/reports')
@RequirePermission(AdminPermission.REPORTS_MANAGE)
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  list(@Query() q: ReportListQueryDto): Promise<Paginated<AdminReportView>> {
    return this.reports.list(q);
  }

  @Get(':id')
  detail(@Param() p: IdParamDto): Promise<AdminReportDetailView> {
    return this.reports.detail(p.id);
  }

  @Patch(':id')
  @Audit({ action: 'report.review', resourceType: 'Report' })
  review(
    @Param() p: IdParamDto,
    @Body() dto: ReportReviewDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<AdminReportDetailView> {
    return this.reports.review(p.id, dto, admin);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(
    @Param() p: IdParamDto,
    @Body() dto: ReportResolveDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<AdminReportDetailView> {
    return this.reports.resolve(p.id, dto, admin);
  }
}
