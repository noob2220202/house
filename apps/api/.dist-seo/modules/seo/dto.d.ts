import { z } from 'zod';
/** Region key: 8-digit 읍면동 or 10-digit 리 (legacy 46150… codes are canonicalized). */
export declare const seoRegionParamSchema: z.ZodObject<{
    code: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
}, z.core.$strip>;
export type SeoRegionParam = z.infer<typeof seoRegionParamSchema>;
/** GET /seo/regions/:code/landing?assetTypes=APT,OFFICETEL (default: every asset type). */
export declare const seoLandingQuerySchema: z.ZodObject<{
    assetTypes: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly APT: "APT";
        readonly OFFICETEL: "OFFICETEL";
        readonly ONEROOM: "ONEROOM";
        readonly HOUSE: "HOUSE";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly LAND: "LAND";
    }>>>, unknown>;
}, z.core.$strip>;
export type SeoLandingQuery = z.infer<typeof seoLandingQuerySchema>;
/** GET /seo/reports/apartment-trades?ym=YYYYMM (default: latest reported month). */
export declare const seoReportQuerySchema: z.ZodObject<{
    ym: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type SeoReportQuery = z.infer<typeof seoReportQuerySchema>;
export declare const SEO_SITEMAP_KINDS: readonly ["complexes", "listings", "agencies"];
export declare const seoSitemapParamSchema: z.ZodObject<{
    kind: z.ZodEnum<{
        listings: "listings";
        agencies: "agencies";
        complexes: "complexes";
    }>;
}, z.core.$strip>;
declare const SeoRegionParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    code: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
}, z.core.$strip>>;
export declare class SeoRegionParamDto extends SeoRegionParamDto_base {
}
declare const SeoLandingQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    assetTypes: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly APT: "APT";
        readonly OFFICETEL: "OFFICETEL";
        readonly ONEROOM: "ONEROOM";
        readonly HOUSE: "HOUSE";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly LAND: "LAND";
    }>>>, unknown>;
}, z.core.$strip>>;
export declare class SeoLandingQueryDto extends SeoLandingQueryDto_base {
}
declare const SeoReportQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    ym: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>>;
export declare class SeoReportQueryDto extends SeoReportQueryDto_base {
}
declare const SeoSitemapParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    kind: z.ZodEnum<{
        listings: "listings";
        agencies: "agencies";
        complexes: "complexes";
    }>;
}, z.core.$strip>>;
export declare class SeoSitemapParamDto extends SeoSitemapParamDto_base {
}
declare const SeoIdParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    id: z.ZodUUID;
}, z.core.$strip>>;
export declare class SeoIdParamDto extends SeoIdParamDto_base {
}
export {};
