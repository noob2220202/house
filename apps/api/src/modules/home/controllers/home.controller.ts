import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators';
import { PopularRegionsQueryDto } from '../dto';
import {
  HomeStatsService,
  type HomeSummaryView,
  type PopularRegionsView,
} from '../services/home-stats.service';

@ApiTags('home')
@Controller('home')
export class HomeController {
  constructor(private readonly stats: HomeStatsService) {}

  /** Site-wide counters + 지역 현황 of the home hero (cached ~2 min). */
  @Public()
  @Get('summary')
  summary(): Promise<HomeSummaryView> {
    return this.stats.summary();
  }

  /** 많이 찾는 지역: 읍면동/리 by this week's listing views, with listing counts per deal type. */
  @Public()
  @Get('popular-regions')
  popularRegions(@Query() q: PopularRegionsQueryDto): Promise<PopularRegionsView> {
    return this.stats.popularRegions(q);
  }
}
