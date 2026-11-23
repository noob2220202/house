// Owned by the complexes module team.
import { z } from 'zod';
import { RegionLevel } from '../enums/region';
import { TradeDealType, TradeSyncKind, TradeSyncStatus } from '../enums/complex';
import { AssetType } from '../enums/listing';
import { REGION_CODE_LENGTH } from '../constants/region';
import { isValidYearMonth } from '../complexes/year-month';
import {
  dateOnlySchema,
  idSchema,
  latSchema,
  lngSchema,
  paginationQuerySchema,
  queryBoolean,
  regionCodeSchema,
} from './common';

/** YYYYMM as an integer (e.g. 202410); accepts "202410" from query strings / JSON. */
export const yearMonthSchema = z.coerce
  .number({ error: '연월은 YYYYMM 형식이어야 합니다.' })
  .int()
  .refine(isValidYearMonth, '연월은 YYYYMM 형식이어야 합니다.');

/** 단지 asset types (아파트 / 오피스텔). */
export const complexAssetTypeSchema = z.enum([AssetType.APT, AssetType.OFFICETEL]);

/** 읍면동 code (8 digits: 시도 2 + 시군구 3 + 읍면동 3). */
export const emdCodeSchema = z
  .string()
  .regex(new RegExp(`^\\d{${REGION_CODE_LENGTH.EMD}}$`), '올바른 읍면동 코드가 아닙니다.');

const searchText = z.string().trim().min(1).max(50);

// ---------- public queries ----------

export const complexSearchQuerySchema = paginationQuerySchema.extend({
  /** 단지명 / 주소 (초성 검색 지원: "ㅇㅎㅂㅇ"). */
  q: searchText.optional(),
  emdCode: emdCodeSchema.optional(),
  assetType: complexAssetTypeSchema.optional(),
  sort: z.enum(['relevance', 'name', 'popular', 'households', 'newest']).default('relevance'),
});
export type ComplexSearchQuery = z.infer<typeof complexSearchQuerySchema>;

export const complexAutocompleteQuerySchema = z.object({
  q: searchText,
  limit: z.coerce.number().int().min(1).max(20).default(8),
});
export type ComplexAutocompleteQuery = z.infer<typeof complexAutocompleteQuerySchema>;

export const complexTradesQuerySchema = paginationQuerySchema
  .extend({
    dealType: z.enum(TradeDealType).optional(),
    areaTypeId: idSchema.optional(),
    fromYm: yearMonthSchema.optional(),
    toYm: yearMonthSchema.optional(),
    includeCancelled: queryBoolean.default(false),
  })
  .refine((q) => q.fromYm === undefined || q.toYm === undefined || q.fromYm <= q.toYm, {
    message: '조회 기간을 확인해 주세요.',
    path: ['fromYm'],
  });
export type ComplexTradesQuery = z.infer<typeof complexTradesQuerySchema>;

export const complexStatsQuerySchema = z.object({
  dealType: z.enum(TradeDealType).default(TradeDealType.SALE),
  areaTypeId: idSchema.optional(),
  /** Trend window in months, ending at the latest month with data. */
  months: z.coerce.number().int().min(1).max(120).default(36),
});
export type ComplexStatsQuery = z.infer<typeof complexStatsQuerySchema>;

export const popularComplexesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  emdCode: emdCodeSchema.optional(),
});
export type PopularComplexesQuery = z.infer<typeof popularComplexesQuerySchema>;

export const regionListQuerySchema = z.object({
  /** Defaults to the service 시군구 (REGION_SGG_CODE) → its 읍면동. */
  parentCode: regionCodeSchema.optional(),
  level: z.enum(RegionLevel).optional(),
  includeInactive: queryBoolean.default(false),
});
export type RegionListQuery = z.infer<typeof regionListQuerySchema>;

export const regionCodeParamSchema = z.object({ code: regionCodeSchema });

// ---------- admin inputs ----------

const optionalCount = z.int().min(0).max(100_000).nullable().optional();
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const complexAreaTypeInputSchema = z.object({
  /** 전용면적 ㎡ */
  exclusiveArea: z.number().positive().max(10_000),
  /** 공급면적 ㎡ */
  supplyArea: z.number().positive().max(10_000).nullable().optional(),
  typeName: z.string().trim().max(20).default(''),
  /** e.g. "34평"; derived from 공급면적 when omitted. */
  pyeongLabel: optionalText(20),
  households: optionalCount,
  rooms: z.int().min(0).max(20).nullable().optional(),
  baths: z.int().min(0).max(20).nullable().optional(),
});
export type ComplexAreaTypeInput = z.infer<typeof complexAreaTypeInputSchema>;

export const complexAreaTypeUpdateSchema = complexAreaTypeInputSchema
  .partial()
  .extend({ typeName: z.string().trim().max(20).optional() })
  .refine((v) => Object.keys(v).length > 0, '변경할 항목이 없습니다.');
export type ComplexAreaTypeUpdate = z.infer<typeof complexAreaTypeUpdateSchema>;

const complexFields = {
  name: z.string().trim().min(1).max(100),
  assetType: complexAssetTypeSchema.default(AssetType.APT),
  roadAddress: optionalText(200),
  jibunAddress: optionalText(200),
  emdCode: emdCodeSchema.nullable().optional(),
  /** 법정동/리 name as 국토교통부 reports it (umdNm); derived from 지번주소 or the 읍면동 when omitted. */
  emdName: optionalText(50),
  /** 지번 (본번-부번) used to match 국토교통부 trades, e.g. "1234-5". */
  jibun: z
    .string()
    .trim()
    .regex(/^산?\d{1,5}(-\d{1,5})?$/, '지번은 "본번-부번" 형식입니다.')
    .nullable()
    .optional(),
  lat: latSchema,
  lng: lngSchema,
  households: optionalCount,
  buildings: z.int().min(0).max(1000).nullable().optional(),
  floorsMin: z.int().min(1).max(200).nullable().optional(),
  floorsMax: z.int().min(1).max(200).nullable().optional(),
  /** 사용승인일 */
  approvalDate: dateOnlySchema.nullable().optional(),
  builtYear: z.int().min(1900).max(2100).nullable().optional(),
  parkingTotal: optionalCount,
  parkingPerHousehold: z.number().min(0).max(100).nullable().optional(),
  floorAreaRatio: z.number().min(0).max(10_000).nullable().optional(),
  buildingCoverageRatio: z.number().min(0).max(100).nullable().optional(),
  heatingType: optionalText(50),
  builder: optionalText(100),
  /** 국토교통부 aptSeq (단지 일련번호) — exact trade matching. */
  externalCode: z
    .string()
    .trim()
    .regex(/^[0-9A-Za-z_-]{1,40}$/, '올바른 단지 코드가 아닙니다.')
    .nullable()
    .optional(),
};

const floorsOrdered = (v: { floorsMin?: number | null; floorsMax?: number | null }): boolean =>
  v.floorsMin == null || v.floorsMax == null || v.floorsMin <= v.floorsMax;

export const complexCreateSchema = z
  .object({
    ...complexFields,
    areaTypes: z.array(complexAreaTypeInputSchema).max(50).default([]),
  })
  .refine(floorsOrdered, { message: '최저층이 최고층보다 높습니다.', path: ['floorsMin'] });
export type ComplexCreateInput = z.infer<typeof complexCreateSchema>;

export const complexUpdateSchema = z
  .object(complexFields)
  .partial()
  // `.partial()` keeps defaults; an update must never reset the asset type implicitly.
  .extend({ assetType: complexAssetTypeSchema.optional() })
  .refine(floorsOrdered, { message: '최저층이 최고층보다 높습니다.', path: ['floorsMin'] })
  .refine((v) => Object.keys(v).length > 0, '변경할 항목이 없습니다.');
export type ComplexUpdateInput = z.infer<typeof complexUpdateSchema>;

export const complexPhotosInputSchema = z.object({
  items: z
    .array(z.object({ mediaId: idSchema, caption: optionalText(100) }))
    .max(30)
    .refine((items) => new Set(items.map((i) => i.mediaId)).size === items.length, {
      message: '같은 사진이 중복되었습니다.',
    }),
});
export type ComplexPhotosInput = z.infer<typeof complexPhotosInputSchema>;

export const adminComplexListQuerySchema = paginationQuerySchema.extend({
  q: searchText.optional(),
  emdCode: emdCodeSchema.optional(),
  includeDeleted: queryBoolean.default(false),
  /** Only complexes without a 국토교통부 code (to fill in for exact matching). */
  missingExternalCode: queryBoolean.default(false),
});
export type AdminComplexListQuery = z.infer<typeof adminComplexListQuerySchema>;

export const complexAreaTypeParamSchema = z.object({ id: idSchema, areaTypeId: idSchema });

export const tradeSyncRequestSchema = z.object({
  yearMonth: yearMonthSchema,
  kinds: z
    .array(z.enum(TradeSyncKind))
    .min(1)
    .max(2)
    .default([TradeSyncKind.APT_TRADE, TradeSyncKind.APT_RENT])
    .transform((k) => [...new Set(k)]),
});
export type TradeSyncRequest = z.infer<typeof tradeSyncRequestSchema>;

export const tradeSyncRunsQuerySchema = paginationQuerySchema.extend({
  kind: z.enum(TradeSyncKind).optional(),
  status: z.enum(TradeSyncStatus).optional(),
  yearMonth: yearMonthSchema.optional(),
});
export type TradeSyncRunsQuery = z.infer<typeof tradeSyncRunsQuerySchema>;

export const tradeRematchRequestSchema = z.object({
  /** Re-match unmatched trades from this month on (default: all). */
  fromYm: yearMonthSchema.optional(),
});
export type TradeRematchRequest = z.infer<typeof tradeRematchRequestSchema>;

export const regionUpsertSchema = z.object({
  name: z.string().trim().min(1).max(50),
  fullName: z.string().trim().min(1).max(200),
  level: z.enum(RegionLevel),
  parentCode: regionCodeSchema.nullable().optional(),
  lat: latSchema.nullable().optional(),
  lng: lngSchema.nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.int().min(0).max(100_000).default(0),
});
export type RegionUpsertInput = z.infer<typeof regionUpsertSchema>;
