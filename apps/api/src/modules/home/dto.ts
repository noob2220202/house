import {
  AssetType,
  canonicalRegionCode,
  csvArray,
  idParamSchema,
  paginationQuerySchema,
} from '@house/shared';
import { z } from 'zod';
import { createZodDto } from '../../common/pipes/zod-validation.pipe';
import { MAX_INTEREST_REGIONS } from './constants';

/*
 * Contracts of the home module. The web app was built against mock handlers
 * (apps/web/src/app/mock-api/v1/{home,search,geo,policies,me}/**); these schemas follow them
 * exactly (DECISIONS "Source of truth" #2) and live here until they move to @house/shared.
 */

/** Integer query param clamped into [min, max]; missing / not a number → `fallback` (like the mocks). */
export const clampedInt = (min: number, max: number, fallback: number) =>
  z.preprocess((v) => {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback;
  }, z.number().int());

/** Strips control characters and collapses whitespace. */
export const cleanText = (s: string): string =>
  s
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export class IdParamDto extends createZodDto(idParamSchema) {}
export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}

/** GET /home/popular-regions?assetTypes&limit */
export const popularRegionsQuerySchema = z.object({
  assetTypes: csvArray(z.enum(AssetType, { error: '알 수 없는 매물 종류입니다.' })),
  limit: clampedInt(1, 50, 10),
});
export type PopularRegionsQuery = z.infer<typeof popularRegionsQuerySchema>;
export class PopularRegionsQueryDto extends createZodDto(popularRegionsQuerySchema) {}

/** GET /search/suggest?q&limit — q is cut to 50 characters, empty q answers only `popular`. */
export const searchSuggestQuerySchema = z.object({
  q: z.preprocess((v) => (typeof v === 'string' ? cleanText(v).slice(0, 50) : ''), z.string()),
  limit: clampedInt(1, 20, 8),
});
export type SearchSuggestQuery = z.infer<typeof searchSuggestQuerySchema>;
export class SearchSuggestQueryDto extends createZodDto(searchSuggestQuerySchema) {}

/** GET /geo/geocode?query — 2…100 characters (ignoring spaces for the minimum). */
export const geocodeQuerySchema = z.object({
  query: z.preprocess(
    (v) => (typeof v === 'string' ? cleanText(v) : ''),
    z
      .string()
      .refine((s) => s.replace(/\s/g, '').length >= 2, '검색어를 2자 이상 입력해 주세요.')
      .refine((s) => s.length <= 100, '검색어는 100자 이내로 입력해 주세요.'),
  ),
});
export type GeocodeQuery = z.infer<typeof geocodeQuerySchema>;
export class GeocodeQueryDto extends createZodDto(geocodeQuerySchema) {}

/** Slug of an operating policy page (`false-listing`). */
export const policySlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, '올바른 문서 주소가 아닙니다.')
  .max(50);
export class PolicySlugParamDto extends createZodDto(z.object({ slug: z.string().max(100) })) {}

/**
 * 관심 지역 key: a stable site key ("sindae") or a 법정동 code. Codes are stored canonical
 * (legacy 46150… → 12150…, DECISIONS D1).
 */
export const interestRegionKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/, '지역 값이 올바르지 않습니다.')
  .transform((k) => (/^\d+$/.test(k) ? canonicalRegionCode(k) : k));

/** PUT /me/interest-regions — replaces the selection (max 5, duplicates dropped). */
export const interestRegionsInputSchema = z.object({
  regionKeys: z
    .array(interestRegionKeySchema)
    .max(MAX_INTEREST_REGIONS, `관심 지역은 ${MAX_INTEREST_REGIONS}곳까지 고를 수 있어요.`)
    .transform((keys) => [...new Set(keys)]),
  notify: z.boolean(),
});
export type InterestRegionsInput = z.infer<typeof interestRegionsInputSchema>;
export class InterestRegionsInputDto extends createZodDto(interestRegionsInputSchema) {}

// ---- admin: policies ------------------------------------------------------------------------

const policyTitle = z.string().trim().min(1, '제목을 입력해 주세요.').max(100);
const policyContent = z.string().trim().min(1, '내용을 입력해 주세요.').max(50_000);
const policyVersion = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^[0-9A-Za-z._-]+$/, '버전이 올바르지 않습니다.');

export const policyAdminListQuerySchema = paginationQuerySchema.extend({
  slug: policySlugSchema.optional(),
});
export type PolicyAdminListQuery = z.infer<typeof policyAdminListQuerySchema>;
export class PolicyAdminListQueryDto extends createZodDto(policyAdminListQuerySchema) {}

export const policyCreateSchema = z.object({
  slug: policySlugSchema,
  version: policyVersion,
  title: policyTitle,
  content: policyContent,
  effectiveAt: z.iso.datetime({ offset: true }),
});
export type PolicyCreateInput = z.infer<typeof policyCreateSchema>;
export class PolicyCreateDto extends createZodDto(policyCreateSchema) {}

export const policyUpdateSchema = z
  .object({
    title: policyTitle.optional(),
    content: policyContent.optional(),
    effectiveAt: z.iso.datetime({ offset: true }).optional(),
  })
  .refine((o) => Object.values(o).some((v) => v !== undefined), '바꿀 내용을 입력해 주세요.');
export type PolicyUpdateInput = z.infer<typeof policyUpdateSchema>;
export class PolicyUpdateDto extends createZodDto(policyUpdateSchema) {}
