import type { AdminPrincipal } from '../../../common/auth/principal';
import { SiteSettingKeyParamDto } from '../dto';
import { type AdminSiteSettingView, SiteSettingsService } from '../services/site-settings.service';
/** Site settings (ADMIN+). PUT body is the setting value itself, validated per key. */
export declare class AdminSiteSettingsController {
    private readonly settings;
    constructor(settings: SiteSettingsService);
    list(): Promise<AdminSiteSettingView[]>;
    get(p: SiteSettingKeyParamDto): Promise<AdminSiteSettingView>;
    put(p: SiteSettingKeyParamDto, value: unknown, admin: AdminPrincipal): Promise<AdminSiteSettingView>;
}
