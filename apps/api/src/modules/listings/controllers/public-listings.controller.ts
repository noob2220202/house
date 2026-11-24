import type { ListingDetail, ListingPage, MapSearchResult } from '@house/shared';
import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import type { Principal } from '../../../common/auth/principal';
import { CurrentPrincipal, Public } from '../../../common/decorators';
import { IdParamDto, ListingListQueryDto, MapSearchQueryDto } from '../dto';
import { ListingQueryService } from '../services/listing-query.service';
import { MapSearchService } from '../services/map-search.service';
import { SimilarListingsService, type SimilarListings } from '../services/similar-listings.service';

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
  constructor(
    private readonly listings: ListingQueryService,
    private readonly similarListings: SimilarListingsService,
  ) {}

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

  /** 비슷한 매물: 같은 단지 · 같은 지역 같은 평형 · 같은 가격대 (first cards + totals). */
  @Public()
  @Get(':id/similar')
  similar(@Param() p: IdParamDto): Promise<SimilarListings> {
    return this.similarListings.similar(p.id);
  }

  /**
   * View beacon of the detail page: counts a deduped view (same viewer key as GET /listings/:id,
   * so the SSR read and the beacon count once) and records the recent view of a signed-in user.
   */
  @Public()
  @Post(':id/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  async view(
    @Param() p: IdParamDto,
    @CurrentPrincipal() principal: Principal | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    await this.listings.recordView(p.id, principal);
  }
}
