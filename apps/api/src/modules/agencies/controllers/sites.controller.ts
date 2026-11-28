import type { PublicAgencySite } from '@house/shared';
import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators';
import { SiteSlugParamDto } from '../dto';
import { AgencySitesService } from '../services/agency-sites.service';

/**
 * 사무소 홈페이지 data for the web's office-site pages (`https://<slug>.<root>`), anonymous.
 * 404 AGENCY_SITE_NOT_FOUND unless the site is servable (ACTIVE, office APPROVED, subscription
 * gate); https readiness is not required here.
 */
@ApiTags('agencies')
@Public()
@Controller('sites')
export class SitesController {
  constructor(private readonly sites: AgencySitesService) {}

  @Get(':slug')
  get(@Param() p: SiteSlugParamDto): Promise<PublicAgencySite> {
    return this.sites.publicSite(p.slug);
  }
}
