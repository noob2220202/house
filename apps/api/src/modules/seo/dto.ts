import {
  AssetType,
  canonicalRegionCode,
  csvArray,
  idParamSchema,
  isValidYearMonth,
} from '@house/shared';
import { z } from 'zod';
import { createZodDto } from '../../common/pipes/zod-validation.pipe';
import type { SeoSitemapKind } from './seo.types';

/*
 * Query / param contracts of the seo module (read-only, public). Mirrored by the web mock handlers
 * in apps/web/src/app/mock-api/v1/seo/**.
 */

/** Region key: 8-digit 읍면동 or 10-digit 리 (legacy 46150… codes are canonicalized). */
export const seoRegionParamSchema = z.object({
  code: z
    .string()
    .regex(/^\d{8}(\d{2})?$/, '올바른 지역코드가 아닙니다.')
    .transform(canonicalRegionCode),
});
export type SeoRegionParam = z.infer<typeof seoRegionParamSchema>;

/** GET /seo/regions/:code/landing?assetTypes=APT,OFFICETEL (default: every asset type). */
export const seoLandingQuerySchema = z.object({
  assetTypes: csvArray(z.enum(AssetType, { error: '알 수 없는 매물 종류입니다.' })),
});
export type SeoLandingQuery = z.infer<typeof seoLandingQuerySchema>;

/** GET /seo/reports/apartment-trades?ym=YYYYMM (default: latest reported month). */
export const seoReportQuerySchema = z.object({
  ym: z.coerce
    .number({ error: '연월은 YYYYMM 형식이어야 합니다.' })
    .int()
    .refine(isValidYearMonth, '연월은 YYYYMM 형식이어야 합니다.')
    .optional(),
});
export type SeoReportQuery = z.infer<typeof seoReportQuerySchema>;

export const SEO_SITEMAP_KINDS = ['complexes', 'listings', 'agencies'] as const satisfies readonly SeoSitemapKind[];
export const seoSitemapParamSchema = z.object({
  kind: z.enum(SEO_SITEMAP_KINDS, { error: '알 수 없는 사이트맵입니다.' }),
});

export class SeoRegionParamDto extends createZodDto(seoRegionParamSchema) {}
export class SeoLandingQueryDto extends createZodDto(seoLandingQuerySchema) {}
export class SeoReportQueryDto extends createZodDto(seoReportQuerySchema) {}
export class SeoSitemapParamDto extends createZodDto(seoSitemapParamSchema) {}
export class SeoIdParamDto extends createZodDto(idParamSchema) {}
