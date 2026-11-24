import { z } from 'zod';
/** Integer query param clamped into [min, max]; missing / not a number → `fallback` (like the mocks). */
export declare const clampedInt: (min: number, max: number, fallback: number) => z.ZodPreprocess<z.ZodNumber, unknown>;
/** Strips control characters and collapses whitespace. */
export declare const cleanText: (s: string) => string;
declare const IdParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    id: z.ZodUUID;
}, z.core.$strip>>;
export declare class IdParamDto extends IdParamDto_base {
}
declare const PaginationQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>>;
export declare class PaginationQueryDto extends PaginationQueryDto_base {
}
/** GET /home/popular-regions?assetTypes&limit */
export declare const popularRegionsQuerySchema: z.ZodObject<{
    assetTypes: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly APT: "APT";
        readonly OFFICETEL: "OFFICETEL";
        readonly ONEROOM: "ONEROOM";
        readonly HOUSE: "HOUSE";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly LAND: "LAND";
    }>>>, unknown>;
    limit: z.ZodPreprocess<z.ZodNumber, unknown>;
}, z.core.$strip>;
export type PopularRegionsQuery = z.infer<typeof popularRegionsQuerySchema>;
declare const PopularRegionsQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    assetTypes: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly APT: "APT";
        readonly OFFICETEL: "OFFICETEL";
        readonly ONEROOM: "ONEROOM";
        readonly HOUSE: "HOUSE";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly LAND: "LAND";
    }>>>, unknown>;
    limit: z.ZodPreprocess<z.ZodNumber, unknown>;
}, z.core.$strip>>;
export declare class PopularRegionsQueryDto extends PopularRegionsQueryDto_base {
}
/** GET /search/suggest?q&limit — q is cut to 50 characters, empty q answers only `popular`. */
export declare const searchSuggestQuerySchema: z.ZodObject<{
    q: z.ZodPreprocess<z.ZodString, unknown>;
    limit: z.ZodPreprocess<z.ZodNumber, unknown>;
}, z.core.$strip>;
export type SearchSuggestQuery = z.infer<typeof searchSuggestQuerySchema>;
declare const SearchSuggestQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    q: z.ZodPreprocess<z.ZodString, unknown>;
    limit: z.ZodPreprocess<z.ZodNumber, unknown>;
}, z.core.$strip>>;
export declare class SearchSuggestQueryDto extends SearchSuggestQueryDto_base {
}
/** GET /geo/geocode?query — 2…100 characters (ignoring spaces for the minimum). */
export declare const geocodeQuerySchema: z.ZodObject<{
    query: z.ZodPreprocess<z.ZodString, unknown>;
}, z.core.$strip>;
export type GeocodeQuery = z.infer<typeof geocodeQuerySchema>;
declare const GeocodeQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    query: z.ZodPreprocess<z.ZodString, unknown>;
}, z.core.$strip>>;
export declare class GeocodeQueryDto extends GeocodeQueryDto_base {
}
/** Slug of an operating policy page (`false-listing`). */
export declare const policySlugSchema: z.ZodString;
declare const PolicySlugParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    slug: z.ZodString;
}, z.core.$strip>>;
export declare class PolicySlugParamDto extends PolicySlugParamDto_base {
}
/**
 * 관심 지역 key: a stable site key ("sindae") or a 법정동 code. Codes are stored canonical
 * (legacy 46150… → 12150…, DECISIONS D1).
 */
export declare const interestRegionKeySchema: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
/** PUT /me/interest-regions — replaces the selection (max 5, duplicates dropped). */
export declare const interestRegionsInputSchema: z.ZodObject<{
    regionKeys: z.ZodPipe<z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>, z.ZodTransform<string[], string[]>>;
    notify: z.ZodBoolean;
}, z.core.$strip>;
export type InterestRegionsInput = z.infer<typeof interestRegionsInputSchema>;
declare const InterestRegionsInputDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    regionKeys: z.ZodPipe<z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>, z.ZodTransform<string[], string[]>>;
    notify: z.ZodBoolean;
}, z.core.$strip>>;
export declare class InterestRegionsInputDto extends InterestRegionsInputDto_base {
}
export declare const policyAdminListQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    slug: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PolicyAdminListQuery = z.infer<typeof policyAdminListQuerySchema>;
declare const PolicyAdminListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    slug: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare class PolicyAdminListQueryDto extends PolicyAdminListQueryDto_base {
}
export declare const policyCreateSchema: z.ZodObject<{
    slug: z.ZodString;
    version: z.ZodString;
    title: z.ZodString;
    content: z.ZodString;
    effectiveAt: z.ZodISODateTime;
}, z.core.$strip>;
export type PolicyCreateInput = z.infer<typeof policyCreateSchema>;
declare const PolicyCreateDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    slug: z.ZodString;
    version: z.ZodString;
    title: z.ZodString;
    content: z.ZodString;
    effectiveAt: z.ZodISODateTime;
}, z.core.$strip>>;
export declare class PolicyCreateDto extends PolicyCreateDto_base {
}
export declare const policyUpdateSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    effectiveAt: z.ZodOptional<z.ZodISODateTime>;
}, z.core.$strip>;
export type PolicyUpdateInput = z.infer<typeof policyUpdateSchema>;
declare const PolicyUpdateDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    effectiveAt: z.ZodOptional<z.ZodISODateTime>;
}, z.core.$strip>>;
export declare class PolicyUpdateDto extends PolicyUpdateDto_base {
}
export {};
