import type { AdminListingDetail, AdminListingListItem, Paginated } from '@house/shared';
import { AdminPermission } from '@house/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Audit } from '../../../common/decorators';
import { AdminListingListQueryDto, AdminListingModerationDto, IdParamDto } from '../dto';
import { RequirePermission } from '../permissions.decorator';
import { AdminListingsService } from '../services/admin-listings.service';

/** Listing moderation across all agencies: hide / unhide / force close. */
@ApiTags('admin/listings')
@RequirePermission(AdminPermission.LISTINGS_MODERATE)
@Controller('admin/listings')
export class AdminListingsController {
  constructor(private readonly listings: AdminListingsService) {}

  @Get()
  list(@Query() q: AdminListingListQueryDto): Promise<Paginated<AdminListingListItem>> {
    return this.listings.list(q);
  }

  @Get(':id')
  detail(@Param() p: IdParamDto): Promise<AdminListingDetail> {
    return this.listings.detail(p.id);
  }

  @Post(':id/hide')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'listing.hide', resourceType: 'Listing' })
  hide(
    @Param() p: IdParamDto,
    @Body() dto: AdminListingModerationDto,
  ): Promise<AdminListingDetail> {
    return this.listings.hide(p.id, dto);
  }

  @Post(':id/unhide')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'listing.unhide', resourceType: 'Listing' })
  unhide(@Param() p: IdParamDto): Promise<AdminListingDetail> {
    return this.listings.unhide(p.id);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'listing.force-close', resourceType: 'Listing' })
  close(
    @Param() p: IdParamDto,
    @Body() dto: AdminListingModerationDto,
  ): Promise<AdminListingDetail> {
    return this.listings.forceClose(p.id, dto);
  }
}
