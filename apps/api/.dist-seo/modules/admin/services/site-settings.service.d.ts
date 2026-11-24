import { type PublicSiteSettings, SiteSettingKey, type SiteSettingView } from '@house/shared';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';
/**
 * Shared `SiteSettingView` plus `updatedByAdminName` (= `updatedBy.name`), the field the admin
 * app's site-setting forms read (`siteSettingSchema` in apps/admin m-content).
 */
export type AdminSiteSettingView = SiteSettingView & {
    updatedByAdminName: string | null;
};
/**
 * Key/value site settings (사업자 정보, 고객센터, SEO, 기능, 푸터). Values are validated by
 * `siteSettingSchemas[key]` on write. The public bundle is cached and invalidated on every write.
 */
export declare class SiteSettingsService {
    private readonly prisma;
    private readonly cache;
    constructor(prisma: PrismaService, cache: CacheService);
    publicSettings(): Promise<PublicSiteSettings>;
    list(): Promise<AdminSiteSettingView[]>;
    get(key: SiteSettingKey): Promise<AdminSiteSettingView>;
    put(key: SiteSettingKey, value: unknown, admin: AdminPrincipal): Promise<AdminSiteSettingView>;
}
