import { SeoIdParamDto, SeoLandingQueryDto, SeoRegionParamDto, SeoReportQueryDto, SeoSitemapParamDto } from './dto';
import type { SeoListingStatusView, SeoRegionIndexView, SeoRegionLandingView, SeoSitemapView, SeoTradeReportView } from './seo.types';
import { SeoRegionsService } from './services/seo-regions.service';
import { SeoReportsService } from './services/seo-reports.service';
import { SeoSitemapService } from './services/seo-sitemap.service';
/** Read-only public data for search landing pages, sitemaps, llms.txt and the 실거래 report. */
export declare class SeoController {
    private readonly regions;
    private readonly reports;
    private readonly sitemaps;
    constructor(regions: SeoRegionsService, reports: SeoReportsService, sitemaps: SeoSitemapService);
    /** 읍면동/리 with listings, 단지 or 아파트 실거래 (counts per asset type; Redis 10 min). */
    regionIndex(): Promise<SeoRegionIndexView>;
    /** Facts of one landing page: listings per deal type, 단지, 12-month 실거래 (Redis 10 min). */
    landing(p: SeoRegionParamDto, q: SeoLandingQueryDto): Promise<SeoRegionLandingView>;
    /** Monthly 아파트 매매 실거래 report (default: latest reported month; Redis 1 h). */
    apartmentTrades(q: SeoReportQueryDto): Promise<SeoTradeReportView>;
    /** Public 단지 / 매물 / 중개사무소 ids with their last change (≤ 50,000; Redis 15 min). */
    sitemap(p: SeoSitemapParamDto): Promise<SeoSitemapView>;
    /** PUBLIC / GONE of a published listing (redirect target for closed listings; not cached). */
    listingStatus(p: SeoIdParamDto): Promise<SeoListingStatusView>;
}
