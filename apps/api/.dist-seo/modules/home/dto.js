"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyUpdateDto = exports.policyUpdateSchema = exports.PolicyCreateDto = exports.policyCreateSchema = exports.PolicyAdminListQueryDto = exports.policyAdminListQuerySchema = exports.InterestRegionsInputDto = exports.interestRegionsInputSchema = exports.interestRegionKeySchema = exports.PolicySlugParamDto = exports.policySlugSchema = exports.GeocodeQueryDto = exports.geocodeQuerySchema = exports.SearchSuggestQueryDto = exports.searchSuggestQuerySchema = exports.PopularRegionsQueryDto = exports.popularRegionsQuerySchema = exports.PaginationQueryDto = exports.IdParamDto = exports.cleanText = exports.clampedInt = void 0;
const shared_1 = require("@house/shared");
const zod_1 = require("zod");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const constants_1 = require("./constants");
/*
 * Contracts of the home module. The web app was built against mock handlers
 * (apps/web/src/app/mock-api/v1/{home,search,geo,policies,me}/**); these schemas follow them
 * exactly (DECISIONS "Source of truth" #2) and live here until they move to @house/shared.
 */
/** Integer query param clamped into [min, max]; missing / not a number → `fallback` (like the mocks). */
const clampedInt = (min, max, fallback) => zod_1.z.preprocess((v) => {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback;
}, zod_1.z.number().int());
exports.clampedInt = clampedInt;
/** Strips control characters and collapses whitespace. */
const cleanText = (s) => s
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
exports.cleanText = cleanText;
class IdParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.idParamSchema) {
}
exports.IdParamDto = IdParamDto;
class PaginationQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.paginationQuerySchema) {
}
exports.PaginationQueryDto = PaginationQueryDto;
/** GET /home/popular-regions?assetTypes&limit */
exports.popularRegionsQuerySchema = zod_1.z.object({
    assetTypes: (0, shared_1.csvArray)(zod_1.z.enum(shared_1.AssetType, { error: '알 수 없는 매물 종류입니다.' })),
    limit: (0, exports.clampedInt)(1, 50, 10),
});
class PopularRegionsQueryDto extends (0, zod_validation_pipe_1.createZodDto)(exports.popularRegionsQuerySchema) {
}
exports.PopularRegionsQueryDto = PopularRegionsQueryDto;
/** GET /search/suggest?q&limit — q is cut to 50 characters, empty q answers only `popular`. */
exports.searchSuggestQuerySchema = zod_1.z.object({
    q: zod_1.z.preprocess((v) => (typeof v === 'string' ? (0, exports.cleanText)(v).slice(0, 50) : ''), zod_1.z.string()),
    limit: (0, exports.clampedInt)(1, 20, 8),
});
class SearchSuggestQueryDto extends (0, zod_validation_pipe_1.createZodDto)(exports.searchSuggestQuerySchema) {
}
exports.SearchSuggestQueryDto = SearchSuggestQueryDto;
/** GET /geo/geocode?query — 2…100 characters (ignoring spaces for the minimum). */
exports.geocodeQuerySchema = zod_1.z.object({
    query: zod_1.z.preprocess((v) => (typeof v === 'string' ? (0, exports.cleanText)(v) : ''), zod_1.z
        .string()
        .refine((s) => s.replace(/\s/g, '').length >= 2, '검색어를 2자 이상 입력해 주세요.')
        .refine((s) => s.length <= 100, '검색어는 100자 이내로 입력해 주세요.')),
});
class GeocodeQueryDto extends (0, zod_validation_pipe_1.createZodDto)(exports.geocodeQuerySchema) {
}
exports.GeocodeQueryDto = GeocodeQueryDto;
/** Slug of an operating policy page (`false-listing`). */
exports.policySlugSchema = zod_1.z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, '올바른 문서 주소가 아닙니다.')
    .max(50);
class PolicySlugParamDto extends (0, zod_validation_pipe_1.createZodDto)(zod_1.z.object({ slug: zod_1.z.string().max(100) })) {
}
exports.PolicySlugParamDto = PolicySlugParamDto;
/**
 * 관심 지역 key: a stable site key ("sindae") or a 법정동 code. Codes are stored canonical
 * (legacy 46150… → 12150…, DECISIONS D1).
 */
exports.interestRegionKeySchema = zod_1.z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, '지역 값이 올바르지 않습니다.')
    .transform((k) => (/^\d+$/.test(k) ? (0, shared_1.canonicalRegionCode)(k) : k));
/** PUT /me/interest-regions — replaces the selection (max 5, duplicates dropped). */
exports.interestRegionsInputSchema = zod_1.z.object({
    regionKeys: zod_1.z
        .array(exports.interestRegionKeySchema)
        .max(constants_1.MAX_INTEREST_REGIONS, `관심 지역은 ${constants_1.MAX_INTEREST_REGIONS}곳까지 고를 수 있어요.`)
        .transform((keys) => [...new Set(keys)]),
    notify: zod_1.z.boolean(),
});
class InterestRegionsInputDto extends (0, zod_validation_pipe_1.createZodDto)(exports.interestRegionsInputSchema) {
}
exports.InterestRegionsInputDto = InterestRegionsInputDto;
// ---- admin: policies ------------------------------------------------------------------------
const policyTitle = zod_1.z.string().trim().min(1, '제목을 입력해 주세요.').max(100);
const policyContent = zod_1.z.string().trim().min(1, '내용을 입력해 주세요.').max(50_000);
const policyVersion = zod_1.z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[0-9A-Za-z._-]+$/, '버전이 올바르지 않습니다.');
exports.policyAdminListQuerySchema = shared_1.paginationQuerySchema.extend({
    slug: exports.policySlugSchema.optional(),
});
class PolicyAdminListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(exports.policyAdminListQuerySchema) {
}
exports.PolicyAdminListQueryDto = PolicyAdminListQueryDto;
exports.policyCreateSchema = zod_1.z.object({
    slug: exports.policySlugSchema,
    version: policyVersion,
    title: policyTitle,
    content: policyContent,
    effectiveAt: zod_1.z.iso.datetime({ offset: true }),
});
class PolicyCreateDto extends (0, zod_validation_pipe_1.createZodDto)(exports.policyCreateSchema) {
}
exports.PolicyCreateDto = PolicyCreateDto;
exports.policyUpdateSchema = zod_1.z
    .object({
    title: policyTitle.optional(),
    content: policyContent.optional(),
    effectiveAt: zod_1.z.iso.datetime({ offset: true }).optional(),
})
    .refine((o) => Object.values(o).some((v) => v !== undefined), '바꿀 내용을 입력해 주세요.');
class PolicyUpdateDto extends (0, zod_validation_pipe_1.createZodDto)(exports.policyUpdateSchema) {
}
exports.PolicyUpdateDto = PolicyUpdateDto;
//# sourceMappingURL=dto.js.map