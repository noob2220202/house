import type {
  Paginated,
  TradeRematchResult,
  TradeSyncResult,
  TradeSyncRunView,
} from '@house/shared';
import { AdminRole } from '@house/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditService } from '../../../common/audit/audit.service';
import { AdminOnly } from '../../../common/decorators';
import { TradeRematchRequestDto, TradeSyncRequestDto, TradeSyncRunsQueryDto } from '../dto';
import { TradeSyncService } from '../trade-sync/trade-sync.service';

/** Manual 실거래가 sync (runs inline, serialized with the scheduled job by a Redis lock). */
@ApiTags('complexes')
@Controller('admin/complexes/trade-sync')
export class AdminTradeSyncController {
  constructor(
    private readonly sync: TradeSyncService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @AdminOnly(AdminRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async run(@Body() dto: TradeSyncRequestDto): Promise<TradeSyncResult> {
    // Audited before running so failed attempts are on record too.
    await this.audit.record({
      action: 'trade-sync.run',
      resourceType: 'TradeSyncRun',
      after: { yearMonth: dto.yearMonth, kinds: dto.kinds },
    });
    return this.sync.syncMonth({ yearMonth: dto.yearMonth, kinds: dto.kinds });
  }

  @Get('runs')
  @AdminOnly(AdminRole.OPERATOR)
  runs(@Query() q: TradeSyncRunsQueryDto): Promise<Paginated<TradeSyncRunView>> {
    return this.sync.listRuns(q);
  }

  @Post('rematch')
  @AdminOnly(AdminRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async rematch(@Body() dto: TradeRematchRequestDto): Promise<TradeRematchResult> {
    const result = await this.sync.rematch(dto.fromYm);
    await this.audit.record({
      action: 'trade-sync.rematch',
      resourceType: 'TradeRecord',
      after: { fromYm: dto.fromYm ?? null, ...result },
    });
    return result;
  }
}
