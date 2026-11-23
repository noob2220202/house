import type {
  AdminBannerView,
  AdminPopupView,
  BannerSlotView,
  BannerStatsView,
  Paginated,
} from '@house/shared';
import { AdminRole } from '@house/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { AdminOnly, Audit, CurrentAdmin } from '../../../common/decorators';
import {
  AdminBannerListQueryDto,
  AdminPopupListQueryDto,
  BannerSlotParamDto,
  BannerStatsQueryDto,
  CreateBannerDto,
  CreatePopupDto,
  IdParamDto,
  ReorderBannersDto,
  ReorderPopupsDto,
  UpdateBannerDto,
  UpdateBannerSlotDto,
  UpdatePopupDto,
} from '../dto';
import { BannerAdminService } from '../services/banner-admin.service';
import { BannerSlotsService } from '../services/banner-slots.service';
import { BannerStatsService } from '../services/banner-stats.service';
import { PopupAdminService } from '../services/popup-admin.service';

@ApiTags('ads')
@Controller('admin/banners')
@AdminOnly(AdminRole.OPERATOR)
export class AdminBannersController {
  constructor(
    private readonly banners: BannerAdminService,
    private readonly stats: BannerStatsService,
  ) {}

  @Get()
  list(@Query() q: AdminBannerListQueryDto): Promise<Paginated<AdminBannerView>> {
    return this.banners.list(q);
  }

  // Declared before ':id' routes so "reorder" is never parsed as an id.
  @Put('reorder')
  reorder(@Body() dto: ReorderBannersDto): Promise<{ items: AdminBannerView[] }> {
    return this.banners.reorder(dto);
  }

  @Get(':id')
  get(@Param() p: IdParamDto): Promise<AdminBannerView> {
    return this.banners.get(p.id);
  }

  @Get(':id/stats')
  bannerStats(@Param() p: IdParamDto, @Query() q: BannerStatsQueryDto): Promise<BannerStatsView> {
    return this.stats.forBanner(p.id, q);
  }

  @Post()
  @Audit({ action: 'banner.create', resourceType: 'Banner' })
  create(
    @Body() dto: CreateBannerDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<AdminBannerView> {
    return this.banners.create(dto, admin.adminId);
  }

  @Patch(':id')
  @Audit({ action: 'banner.update', resourceType: 'Banner' })
  update(@Param() p: IdParamDto, @Body() dto: UpdateBannerDto): Promise<AdminBannerView> {
    return this.banners.update(p.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'banner.delete', resourceType: 'Banner' })
  remove(@Param() p: IdParamDto): Promise<void> {
    return this.banners.remove(p.id);
  }
}

/** Slot limits: readable by operators (banner forms need them), editable by ADMIN+. */
@ApiTags('ads')
@Controller('admin/banner-slots')
@AdminOnly(AdminRole.OPERATOR)
export class AdminBannerSlotsController {
  constructor(private readonly slots: BannerSlotsService) {}

  @Get()
  async list(): Promise<{ items: BannerSlotView[] }> {
    return { items: await this.slots.list() };
  }

  @Get(':slot')
  get(@Param() p: BannerSlotParamDto): Promise<BannerSlotView> {
    return this.slots.get(p.slot);
  }

  @Patch(':slot')
  @AdminOnly(AdminRole.ADMIN)
  @Audit({ action: 'banner-slot.update', resourceType: 'BannerSlotConfig', idParam: 'slot' })
  update(
    @Param() p: BannerSlotParamDto,
    @Body() dto: UpdateBannerSlotDto,
  ): Promise<BannerSlotView> {
    return this.slots.update(p.slot, dto);
  }
}

@ApiTags('ads')
@Controller('admin/popups')
@AdminOnly(AdminRole.OPERATOR)
export class AdminPopupsController {
  constructor(private readonly popups: PopupAdminService) {}

  @Get()
  list(@Query() q: AdminPopupListQueryDto): Promise<Paginated<AdminPopupView>> {
    return this.popups.list(q);
  }

  @Put('reorder')
  reorder(@Body() dto: ReorderPopupsDto): Promise<{ items: AdminPopupView[] }> {
    return this.popups.reorder(dto);
  }

  @Get(':id')
  get(@Param() p: IdParamDto): Promise<AdminPopupView> {
    return this.popups.get(p.id);
  }

  @Post()
  @Audit({ action: 'popup.create', resourceType: 'Popup' })
  create(
    @Body() dto: CreatePopupDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<AdminPopupView> {
    return this.popups.create(dto, admin.adminId);
  }

  @Patch(':id')
  @Audit({ action: 'popup.update', resourceType: 'Popup' })
  update(@Param() p: IdParamDto, @Body() dto: UpdatePopupDto): Promise<AdminPopupView> {
    return this.popups.update(p.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'popup.delete', resourceType: 'Popup' })
  remove(@Param() p: IdParamDto): Promise<void> {
    return this.popups.remove(p.id);
  }
}
