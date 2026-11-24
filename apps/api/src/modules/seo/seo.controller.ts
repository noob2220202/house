import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import {
  SeoIdParamDto,
  SeoLandingQueryDto,
  SeoRegionParamDto,
  SeoReportQueryDto,
  SeoSitemapParamDto,
} from './dto';
import type {
  SeoListingStatusView,
  SeoRegionIndexView,
  SeoRegionLandingView,
  SeoSitemapView,
  SeoTradeReportView,
} from './seo.types';
import { SeoRegionsService } from './services/seo-regions.service';
import { SeoReportsService } from './services/seo-reports.service';
import { SeoSitemapService } from './services/seo-sitemap.service';

/** Read-only public data for search landing pages, sitemaps, llms.txt and the 실거래 report. */
@ApiTags('seo')
@Controller('seo')
export class SeoController {
  constructor(
    private readonly regions: SeoRegionsService,
    private readonly reports: SeoReportsService,
    private readonly sitemaps: SeoSitemapService,
  ) {}

  /** 읍면동/리 with listings, 단지 or 아파트 실거래 (counts per asset type; Redis 10 min). */
  @Public()
  @Get('regions')
  regionIndex(): Promise<SeoRegionIndexView> {
    return this.regions.index();
  }

  /** Facts of one landing page: listings per deal type, 단지, 12-month 실거래 (Redis 10 min). */
  @Public()
  @Get('regions/:code/landing')
  landing(
    @Param() p: SeoRegionParamDto,
    @Query() q: SeoLandingQueryDto,
  ): Promise<SeoRegionLandingView> {
    return this.regions.landing(p.code, q.assetTypes);
  }

  /** Monthly 아파트 매매 실거래 report (default: latest reported month; Redis 1 h). */
  @Public()
  @Get('reports/apartment-trades')
  apartmentTrades(@Query() q: SeoReportQueryDto): Promise<SeoTradeReportView> {
    return this.reports.apartmentTrades(q.ym);
  }

  /** Public 단지 / 매물 / 중개사무소 ids with their last change (≤ 50,000; Redis 15 min). */
  @Public()
  @Get('sitemap/:kind')
  sitemap(@Param() p: SeoSitemapParamDto): Promise<SeoSitemapView> {
    return this.sitemaps.sitemap(p.kind);
  }

  /** PUBLIC / GONE of a published listing (redirect target for closed listings; not cached). */
  @Public()
  @Get('listings/:id/status')
  listingStatus(@Param() p: SeoIdParamDto): Promise<SeoListingStatusView> {
    return this.sitemaps.listingStatus(p.id);
  }
}
