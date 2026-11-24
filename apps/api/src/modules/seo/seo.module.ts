import { Module } from '@nestjs/common';
import { ComplexesModule } from '../complexes/complexes.module';
import { SeoController } from './seo.controller';
import { SeoRegionsService } from './services/seo-regions.service';
import { SeoReportsService } from './services/seo-reports.service';
import { SeoSitemapService } from './services/seo-sitemap.service';

/**
 * Read-only public data for search engines and AI answer engines (web lib/seo): 지역 landing
 * facts, sitemap inventories, listing gone-status and the monthly 실거래 report. Reads 단지 /
 * 매물 / 실거래 rows directly (no writes); regions come from the complexes module.
 */
@Module({
  imports: [ComplexesModule],
  controllers: [SeoController],
  providers: [SeoRegionsService, SeoReportsService, SeoSitemapService],
})
export class SeoModule {}
