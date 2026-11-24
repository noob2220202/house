import {
  adminComplexListQuerySchema,
  complexAreaTypeInputSchema,
  complexAreaTypeParamSchema,
  complexAreaTypeUpdateSchema,
  complexAutocompleteQuerySchema,
  complexCreateSchema,
  complexPhotosInputSchema,
  complexSearchQuerySchema,
  complexStatsQuerySchema,
  complexTradesQuerySchema,
  complexUpdateSchema,
  idParamSchema,
  paginationQuerySchema,
  popularComplexesQuerySchema,
  regionCodeParamSchema,
  regionListQuerySchema,
  regionUpsertSchema,
  tradeRematchRequestSchema,
  tradeSyncJobParamSchema,
  tradeSyncRequestSchema,
  tradeSyncRunsQuerySchema,
} from '@house/shared';
import { z } from 'zod';
import { createZodDto } from '../../common/pipes/zod-validation.pipe';

export class IdParamDto extends createZodDto(idParamSchema) {}
export class AreaTypeParamDto extends createZodDto(complexAreaTypeParamSchema) {}
export class RegionCodeParamDto extends createZodDto(regionCodeParamSchema) {}
export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}

export class ComplexSearchQueryDto extends createZodDto(complexSearchQuerySchema) {}
export class ComplexAutocompleteQueryDto extends createZodDto(complexAutocompleteQuerySchema) {}
export class ComplexTradesQueryDto extends createZodDto(complexTradesQuerySchema) {}
export class ComplexStatsQueryDto extends createZodDto(complexStatsQuerySchema) {}
export class PopularComplexesQueryDto extends createZodDto(popularComplexesQuerySchema) {}
export class RegionListQueryDto extends createZodDto(regionListQuerySchema) {}

export class AdminComplexListQueryDto extends createZodDto(adminComplexListQuerySchema) {}
export class CreateComplexDto extends createZodDto(complexCreateSchema) {}
export class UpdateComplexDto extends createZodDto(complexUpdateSchema) {}
export class CreateAreaTypeDto extends createZodDto(complexAreaTypeInputSchema) {}
export class UpdateAreaTypeDto extends createZodDto(complexAreaTypeUpdateSchema) {}
export class ComplexPhotosDto extends createZodDto(complexPhotosInputSchema) {}
export class TradeSyncRequestDto extends createZodDto(tradeSyncRequestSchema) {}
export class TradeSyncRunsQueryDto extends createZodDto(tradeSyncRunsQuerySchema) {}
export class TradeRematchRequestDto extends createZodDto(tradeRematchRequestSchema) {}
export class TradeSyncJobParamDto extends createZodDto(tradeSyncJobParamSchema) {}
export class RegionUpsertDto extends createZodDto(regionUpsertSchema) {}

/** Integer query param clamped into [min, max]; missing / not a number → `fallback` (like the web mock). */
export const clampedInt = (min: number, max: number, fallback: number) =>
  z.preprocess((v) => {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback;
  }, z.number().int());

/** GET /complexes/:id/nearby?limit&radius (radius in metres). */
export const complexNearbyQuerySchema = z.object({
  limit: clampedInt(1, 30, 10),
  radius: clampedInt(100, 10_000, 3000),
});
export class ComplexNearbyQueryDto extends createZodDto(complexNearbyQuerySchema) {}

/** GET /complexes/:id/agencies?limit */
export const complexAgenciesQuerySchema = z.object({ limit: clampedInt(1, 50, 20) });
export class ComplexAgenciesQueryDto extends createZodDto(complexAgenciesQuerySchema) {}
