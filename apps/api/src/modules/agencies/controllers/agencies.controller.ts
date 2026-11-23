import type { AgencyMapResult, AgencyProfile, AgencySummary, Paginated } from '@house/shared';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators';
import { AgencyMapQueryDto, AgencySearchQueryDto, IdParamDto } from '../dto';
import { AgencyPublicService } from '../services/agency-public.service';

/** 중개사무소 찾기 (public): list search, map, profile. Only APPROVED agencies are visible. */
@ApiTags('agencies')
@Public()
@Controller('agencies')
export class AgenciesController {
  constructor(private readonly agencies: AgencyPublicService) {}

  @Get()
  search(@Query() q: AgencySearchQueryDto): Promise<Paginated<AgencySummary>> {
    return this.agencies.search(q);
  }

  @Get('map')
  map(@Query() q: AgencyMapQueryDto): Promise<AgencyMapResult> {
    return this.agencies.map(q);
  }

  @Get(':id')
  profile(@Param() p: IdParamDto): Promise<AgencyProfile> {
    return this.agencies.profile(p.id);
  }
}
