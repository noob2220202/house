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
  tradeSyncRequestSchema,
  tradeSyncRunsQuerySchema,
} from '@house/shared';
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
export class RegionUpsertDto extends createZodDto(regionUpsertSchema) {}
