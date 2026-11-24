import { AdminPermission } from '@house/shared';
import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { Audit, CurrentAdmin } from '../../../common/decorators';
import { SiteSettingKeyParamDto } from '../dto';
import { RequirePermission } from '../permissions.decorator';
import { type AdminSiteSettingView, SiteSettingsService } from '../services/site-settings.service';

/** Site settings (ADMIN+). PUT body is the setting value itself, validated per key. */
@ApiTags('admin/site-settings')
@RequirePermission(AdminPermission.SETTINGS_MANAGE)
@Controller('admin/site-settings')
export class AdminSiteSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Get()
  list(): Promise<AdminSiteSettingView[]> {
    return this.settings.list();
  }

  @Get(':key')
  get(@Param() p: SiteSettingKeyParamDto): Promise<AdminSiteSettingView> {
    return this.settings.get(p.key);
  }

  @Put(':key')
  @Audit({ action: 'site-setting.update', resourceType: 'SiteSetting', idParam: 'key' })
  put(
    @Param() p: SiteSettingKeyParamDto,
    @Body() value: unknown,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<AdminSiteSettingView> {
    return this.settings.put(p.key, value, admin);
  }
}
