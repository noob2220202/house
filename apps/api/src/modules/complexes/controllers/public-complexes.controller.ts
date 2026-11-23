import type {
  ComplexAutocompleteResult,
  ComplexDetail,
  ComplexListingsSummary,
  ComplexStatsView,
  ComplexSummary,
  Paginated,
  PopularComplexItem,
  TradeView,
} from '@house/shared';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Principal } from '../../../common/auth/principal';
import { CurrentPrincipal, Public } from '../../../common/decorators';
import {
  ComplexAutocompleteQueryDto,
  ComplexSearchQueryDto,
  ComplexStatsQueryDto,
  ComplexTradesQueryDto,
  IdParamDto,
  PopularComplexesQueryDto,
} from '../dto';
import { ComplexPopularityService } from '../services/complex-popularity.service';
import { ComplexQueryService } from '../services/complex-query.service';
import { ComplexSearchService } from '../services/complex-search.service';
import { ComplexTradesService } from '../services/complex-trades.service';

/** Static routes are declared before `:id` so they are matched first. */
@ApiTags('complexes')
@Controller('complexes')
export class PublicComplexesController {
  constructor(
    private readonly search: ComplexSearchService,
    private readonly popularity: ComplexPopularityService,
    private readonly query: ComplexQueryService,
    private readonly trades: ComplexTradesService,
  ) {}

  @Public()
  @Get()
  list(@Query() q: ComplexSearchQueryDto): Promise<Paginated<ComplexSummary>> {
    return this.search.search(q);
  }

  /** 지역(읍면동·리) + 단지명 suggestions; supports 초성 ("ㅇㅎ"). */
  @Public()
  @Get('autocomplete')
  autocomplete(@Query() q: ComplexAutocompleteQueryDto): Promise<ComplexAutocompleteResult> {
    return this.search.autocomplete(q);
  }

  /** 자주 찾는 단지: 30-day time-decayed views, with active listing counts per deal type. */
  @Public()
  @Get('popular')
  popular(@Query() q: PopularComplexesQueryDto): Promise<PopularComplexItem[]> {
    return this.popularity.popular(q);
  }

  @Public()
  @Get(':id')
  detail(
    @Param() p: IdParamDto,
    @CurrentPrincipal() principal: Principal | undefined,
  ): Promise<ComplexDetail> {
    return this.query.detail(p.id, principal);
  }

  @Public()
  @Get(':id/trades')
  tradeList(
    @Param() p: IdParamDto,
    @Query() q: ComplexTradesQueryDto,
  ): Promise<Paginated<TradeView>> {
    return this.trades.list(p.id, q);
  }

  @Public()
  @Get(':id/stats')
  stats(@Param() p: IdParamDto, @Query() q: ComplexStatsQueryDto): Promise<ComplexStatsView> {
    return this.trades.stats(p.id, q);
  }

  @Public()
  @Get(':id/listings')
  listings(@Param() p: IdParamDto): Promise<ComplexListingsSummary> {
    return this.query.listingSummary(p.id);
  }
}
