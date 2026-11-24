"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeoIdParamDto = exports.SeoSitemapParamDto = exports.SeoReportQueryDto = exports.SeoLandingQueryDto = exports.SeoRegionParamDto = exports.seoSitemapParamSchema = exports.SEO_SITEMAP_KINDS = exports.seoReportQuerySchema = exports.seoLandingQuerySchema = exports.seoRegionParamSchema = void 0;
const shared_1 = require("@house/shared");
const zod_1 = require("zod");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
/*
 * Query / param contracts of the seo module (read-only, public). Mirrored by the web mock handlers
 * in apps/web/src/app/mock-api/v1/seo/**.
 */
/** Region key: 8-digit 읍면동 or 10-digit 리 (legacy 46150… codes are canonicalized). */
exports.seoRegionParamSchema = zod_1.z.object({
    code: zod_1.z
        .string()
        .regex(/^\d{8}(\d{2})?$/, '올바른 지역코드가 아닙니다.')
        .transform(shared_1.canonicalRegionCode),
});
/** GET /seo/regions/:code/landing?assetTypes=APT,OFFICETEL (default: every asset type). */
exports.seoLandingQuerySchema = zod_1.z.object({
    assetTypes: (0, shared_1.csvArray)(zod_1.z.enum(shared_1.AssetType, { error: '알 수 없는 매물 종류입니다.' })),
});
/** GET /seo/reports/apartment-trades?ym=YYYYMM (default: latest reported month). */
exports.seoReportQuerySchema = zod_1.z.object({
    ym: zod_1.z.coerce
        .number({ error: '연월은 YYYYMM 형식이어야 합니다.' })
        .int()
        .refine(shared_1.isValidYearMonth, '연월은 YYYYMM 형식이어야 합니다.')
        .optional(),
});
exports.SEO_SITEMAP_KINDS = ['complexes', 'listings', 'agencies'];
exports.seoSitemapParamSchema = zod_1.z.object({
    kind: zod_1.z.enum(exports.SEO_SITEMAP_KINDS, { error: '알 수 없는 사이트맵입니다.' }),
});
class SeoRegionParamDto extends (0, zod_validation_pipe_1.createZodDto)(exports.seoRegionParamSchema) {
}
exports.SeoRegionParamDto = SeoRegionParamDto;
class SeoLandingQueryDto extends (0, zod_validation_pipe_1.createZodDto)(exports.seoLandingQuerySchema) {
}
exports.SeoLandingQueryDto = SeoLandingQueryDto;
class SeoReportQueryDto extends (0, zod_validation_pipe_1.createZodDto)(exports.seoReportQuerySchema) {
}
exports.SeoReportQueryDto = SeoReportQueryDto;
class SeoSitemapParamDto extends (0, zod_validation_pipe_1.createZodDto)(exports.seoSitemapParamSchema) {
}
exports.SeoSitemapParamDto = SeoSitemapParamDto;
class SeoIdParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.idParamSchema) {
}
exports.SeoIdParamDto = SeoIdParamDto;
//# sourceMappingURL=dto.js.map