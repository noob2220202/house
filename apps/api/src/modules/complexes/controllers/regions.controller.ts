import type { RegionView } from '@house/shared';
import { AdminRole } from '@house/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminOnly, Audit, Public } from '../../../common/decorators';
import { RegionCodeParamDto, RegionListQueryDto, RegionUpsertDto } from '../dto';
import { RegionsService } from '../services/regions.service';

@ApiTags('regions')
@Controller('regions')
export class RegionsController {
  constructor(private readonly regions: RegionsService) {}

  /** Children of `parentCode` (default: the service 시군구 → its 읍면동). */
  @Public()
  @Get()
  list(@Query() q: RegionListQueryDto): Promise<RegionView[]> {
    return this.regions.list(q);
  }

  @Public()
  @Get(':code')
  get(@Param() p: RegionCodeParamDto): Promise<RegionView> {
    return this.regions.get(p.code);
  }
}

@ApiTags('regions')
@Controller('admin/regions')
@AdminOnly(AdminRole.ADMIN)
export class AdminRegionsController {
  constructor(private readonly regions: RegionsService) {}

  /** Idempotent load of the bundled 순천시 법정동 list (audited inside the service). */
  @Post('seed-default')
  @HttpCode(HttpStatus.OK)
  seedDefault(): Promise<{ upserted: number }> {
    return this.regions.seedDefault();
  }

  @Put(':code')
  @Audit({ action: 'region.upsert', resourceType: 'Region', idParam: 'code' })
  upsert(@Param() p: RegionCodeParamDto, @Body() dto: RegionUpsertDto): Promise<RegionView> {
    return this.regions.upsert(p.code, dto);
  }
}
