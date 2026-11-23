import type {
  Paginated,
  TradeSyncJobAccepted,
  TradeSyncJobView,
  TradeSyncRunView,
} from '@house/shared';
import { AdminRole, ErrorCode } from '@house/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditService } from '../../../common/audit/audit.service';
import { AdminOnly } from '../../../common/decorators';
import { AppException } from '../../../common/errors/app.exception';
import {
  TradeRematchRequestDto,
  TradeSyncJobParamDto,
  TradeSyncRequestDto,
  TradeSyncRunsQueryDto,
} from '../dto';
import { TradeSyncJobs } from '../trade-sync/trade-sync.jobs';
import { TradeSyncService } from '../trade-sync/trade-sync.service';

/**
 * Manual 실거래가 sync / rematch. Both run as jobs on the trade-sync queue (a sync can take far
 * longer than the proxy timeout): the POST answers 202 with the job id, the admin polls
 * GET jobs/:jobId (result) or GET runs (per-kind run records).
 */
@ApiTags('complexes')
@Controller('admin/complexes/trade-sync')
export class AdminTradeSyncController {
  constructor(
    private readonly sync: TradeSyncService,
    private readonly jobs: TradeSyncJobs,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @AdminOnly(AdminRole.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  async run(@Body() dto: TradeSyncRequestDto): Promise<TradeSyncJobAccepted> {
    this.sync.assertSyncable(dto.yearMonth);
    const accepted = await this.jobs.enqueueMonth(dto.yearMonth, dto.kinds);
    await this.audit.record({
      action: 'trade-sync.run',
      resourceType: 'TradeSyncRun',
      after: { yearMonth: dto.yearMonth, kinds: dto.kinds, jobId: accepted.jobId },
    });
    return accepted;
  }

  @Get('runs')
  @AdminOnly(AdminRole.OPERATOR)
  runs(@Query() q: TradeSyncRunsQueryDto): Promise<Paginated<TradeSyncRunView>> {
    return this.sync.listRuns(q);
  }

  @Get('jobs/:jobId')
  @AdminOnly(AdminRole.OPERATOR)
  async job(@Param() p: TradeSyncJobParamDto): Promise<TradeSyncJobView> {
    const view = await this.jobs.get(p.jobId);
    if (!view) throw AppException.notFound(ErrorCode.TRADE_SYNC_JOB_NOT_FOUND);
    return view;
  }

  @Post('rematch')
  @AdminOnly(AdminRole.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  async rematch(@Body() dto: TradeRematchRequestDto): Promise<TradeSyncJobAccepted> {
    const accepted = await this.jobs.enqueueRematch(dto.fromYm);
    await this.audit.record({
      action: 'trade-sync.rematch',
      resourceType: 'TradeRecord',
      after: { fromYm: dto.fromYm ?? null, jobId: accepted.jobId },
    });
    return accepted;
  }
}
