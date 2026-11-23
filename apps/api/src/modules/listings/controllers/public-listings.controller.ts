import type { ListingDetail, ListingPage, MapSearchResult } from '@house/shared';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Principal } from '../../../common/auth/principal';
import { CurrentPrincipal, Public } from '../../../common/decorators';
import { IdParamDto, ListingListQueryDto, MapSearchQueryDto } from '../dto';
import { ListingQueryService } from '../services/listing-query.service';
import { MapSearchService } from '../services/map-search.service';

@ApiTags('listings')
@Controller('map')
export class MapController {
  constructor(private readonly map: MapSearchService) {}

  /** bbox + zoom + filters → 읍면동 clusters / grid clusters / 단지·매물 markers. */
  @Public()
  @Get('search')
  search(@Query() q: MapSearchQueryDto): Promise<MapSearchResult> {
    return this.map.search(q);
  }
}

@ApiTags('listings')
@Controller('listings')
export class PublicListingsController {
  constructor(private readonly listings: ListingQueryService) {}

  @Public()
  @Get()
  list(@Query() q: ListingListQueryDto): Promise<ListingPage> {
    return this.listings.list(q);
  }

  @Public()
  @Get(':id')
  detail(
    @Param() p: IdParamDto,
    @CurrentPrincipal() principal: Principal | undefined,
  ): Promise<ListingDetail> {
    return this.listings.detail(p.id, principal);
  }
}
