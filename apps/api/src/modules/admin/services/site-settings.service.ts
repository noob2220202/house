import {
  ErrorCode,
  PUBLIC_SITE_SETTING_KEYS,
  type PublicSiteSettings,
  SiteSettingKey,
  siteSettingSchemas,
  type SiteSettingView,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { CacheService } from '../../../common/cache/cache.service';
import { RequestContext } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { formatZodIssues } from '../../../common/errors/zod-issues';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgencySiteGateService } from '../../agencies/services/agency-site-gate.service';
import { ADMIN_CACHE, SITE_SETTINGS_CACHE_TTL_SECONDS } from '../constants';

const ALL_KEYS = Object.values(SiteSettingKey) as SiteSettingKey[];

const settingSelect = {
  key: true,
  value: true,
  updatedAt: true,
  updatedByAdmin: { select: { id: true, name: true } },
} satisfies Prisma.SiteSettingSelect;
type SettingRow = Prisma.SiteSettingGetPayload<{ select: typeof settingSelect }>;

/**
 * Shared `SiteSettingView` plus `updatedByAdminName` (= `updatedBy.name`), the field the admin
 * app's site-setting forms read (`siteSettingSchema` in apps/admin m-content).
 */
export type AdminSiteSettingView = SiteSettingView & { updatedByAdminName: string | null };

function toView(key: SiteSettingKey, row: SettingRow | undefined): AdminSiteSettingView {
  return {
    key,
    value: row?.value ?? null,
    updatedAt: row?.updatedAt.toISOString() ?? null,
    updatedBy: row?.updatedByAdmin ?? null,
    updatedByAdminName: row?.updatedByAdmin?.name ?? null,
  };
}

/**
 * Key/value site settings (사업자 정보, 고객센터, SEO, 기능, 푸터). Values are validated by
 * `siteSettingSchemas[key]` on write. The public bundle is cached and invalidated on every write.
 */
@Injectable()
export class SiteSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly siteGate: AgencySiteGateService,
  ) {}

  async publicSettings(): Promise<PublicSiteSettings> {
    const v = await this.cache.version(ADMIN_CACHE.SITE_SETTINGS);
    return this.cache.getOrSet(
      `cache:admin:site-settings:public:v${v}`,
      SITE_SETTINGS_CACHE_TTL_SECONDS,
      async () => {
        const rows = await this.prisma.siteSetting.findMany({
          where: { key: { in: [...PUBLIC_SITE_SETTING_KEYS] } },
          select: { key: true, value: true },
        });
        const out: PublicSiteSettings = {};
        for (const r of rows) out[r.key as SiteSettingKey] = r.value;
        return out;
      },
    );
  }

  async list(): Promise<AdminSiteSettingView[]> {
    const rows = await this.prisma.siteSetting.findMany({ select: settingSelect });
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return ALL_KEYS.map((k) => toView(k, byKey.get(k)));
  }

  async get(key: SiteSettingKey): Promise<AdminSiteSettingView> {
    const row = await this.prisma.siteSetting.findUnique({ where: { key }, select: settingSelect });
    return toView(key, row ?? undefined);
  }

  async put(
    key: SiteSettingKey,
    value: unknown,
    admin: AdminPrincipal,
  ): Promise<AdminSiteSettingView> {
    const parsed = siteSettingSchemas[key].safeParse(value);
    if (!parsed.success) {
      throw AppException.badRequest(ErrorCode.SETTING_INVALID, formatZodIssues(parsed.error));
    }
    RequestContext.setAuditBefore(await this.get(key));
    const json = parsed.data as Prisma.InputJsonValue;
    const row = await this.prisma.siteSetting.upsert({
      where: { key },
      create: { key, value: json, updatedByAdminId: admin.adminId },
      update: { value: json, updatedByAdminId: admin.adminId },
      select: settingSelect,
    });
    await this.cache.bump(ADMIN_CACHE.SITE_SETTINGS);
    // FEATURES carries the 이용권 switches (siteSubscriptionRequired …): cached office sites and
    // profiles must re-evaluate their gate.
    if (key === SiteSettingKey.FEATURES) await this.siteGate.featuresChanged();
    return toView(key, row);
  }
}
