"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplexAgenciesQueryDto = exports.complexAgenciesQuerySchema = exports.ComplexNearbyQueryDto = exports.complexNearbyQuerySchema = exports.clampedInt = exports.RegionUpsertDto = exports.TradeSyncJobParamDto = exports.TradeRematchRequestDto = exports.TradeSyncRunsQueryDto = exports.TradeSyncRequestDto = exports.ComplexPhotosDto = exports.UpdateAreaTypeDto = exports.CreateAreaTypeDto = exports.UpdateComplexDto = exports.CreateComplexDto = exports.AdminComplexListQueryDto = exports.RegionListQueryDto = exports.PopularComplexesQueryDto = exports.ComplexStatsQueryDto = exports.ComplexTradesQueryDto = exports.ComplexAutocompleteQueryDto = exports.ComplexSearchQueryDto = exports.PaginationQueryDto = exports.RegionCodeParamDto = exports.AreaTypeParamDto = exports.IdParamDto = void 0;
const shared_1 = require("@house/shared");
const zod_1 = require("zod");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
class IdParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.idParamSchema) {
}
exports.IdParamDto = IdParamDto;
class AreaTypeParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.complexAreaTypeParamSchema) {
}
exports.AreaTypeParamDto = AreaTypeParamDto;
class RegionCodeParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.regionCodeParamSchema) {
}
exports.RegionCodeParamDto = RegionCodeParamDto;
class PaginationQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.paginationQuerySchema) {
}
exports.PaginationQueryDto = PaginationQueryDto;
class ComplexSearchQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.complexSearchQuerySchema) {
}
exports.ComplexSearchQueryDto = ComplexSearchQueryDto;
class ComplexAutocompleteQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.complexAutocompleteQuerySchema) {
}
exports.ComplexAutocompleteQueryDto = ComplexAutocompleteQueryDto;
class ComplexTradesQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.complexTradesQuerySchema) {
}
exports.ComplexTradesQueryDto = ComplexTradesQueryDto;
class ComplexStatsQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.complexStatsQuerySchema) {
}
exports.ComplexStatsQueryDto = ComplexStatsQueryDto;
class PopularComplexesQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.popularComplexesQuerySchema) {
}
exports.PopularComplexesQueryDto = PopularComplexesQueryDto;
class RegionListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.regionListQuerySchema) {
}
exports.RegionListQueryDto = RegionListQueryDto;
class AdminComplexListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.adminComplexListQuerySchema) {
}
exports.AdminComplexListQueryDto = AdminComplexListQueryDto;
class CreateComplexDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.complexCreateSchema) {
}
exports.CreateComplexDto = CreateComplexDto;
class UpdateComplexDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.complexUpdateSchema) {
}
exports.UpdateComplexDto = UpdateComplexDto;
class CreateAreaTypeDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.complexAreaTypeInputSchema) {
}
exports.CreateAreaTypeDto = CreateAreaTypeDto;
class UpdateAreaTypeDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.complexAreaTypeUpdateSchema) {
}
exports.UpdateAreaTypeDto = UpdateAreaTypeDto;
class ComplexPhotosDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.complexPhotosInputSchema) {
}
exports.ComplexPhotosDto = ComplexPhotosDto;
class TradeSyncRequestDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.tradeSyncRequestSchema) {
}
exports.TradeSyncRequestDto = TradeSyncRequestDto;
class TradeSyncRunsQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.tradeSyncRunsQuerySchema) {
}
exports.TradeSyncRunsQueryDto = TradeSyncRunsQueryDto;
class TradeRematchRequestDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.tradeRematchRequestSchema) {
}
exports.TradeRematchRequestDto = TradeRematchRequestDto;
class TradeSyncJobParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.tradeSyncJobParamSchema) {
}
exports.TradeSyncJobParamDto = TradeSyncJobParamDto;
class RegionUpsertDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.regionUpsertSchema) {
}
exports.RegionUpsertDto = RegionUpsertDto;
/** Integer query param clamped into [min, max]; missing / not a number → `fallback` (like the web mock). */
const clampedInt = (min, max, fallback) => zod_1.z.preprocess((v) => {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback;
}, zod_1.z.number().int());
exports.clampedInt = clampedInt;
/** GET /complexes/:id/nearby?limit&radius (radius in metres). */
exports.complexNearbyQuerySchema = zod_1.z.object({
    limit: (0, exports.clampedInt)(1, 30, 10),
    radius: (0, exports.clampedInt)(100, 10_000, 3000),
});
class ComplexNearbyQueryDto extends (0, zod_validation_pipe_1.createZodDto)(exports.complexNearbyQuerySchema) {
}
exports.ComplexNearbyQueryDto = ComplexNearbyQueryDto;
/** GET /complexes/:id/agencies?limit */
exports.complexAgenciesQuerySchema = zod_1.z.object({ limit: (0, exports.clampedInt)(1, 50, 20) });
class ComplexAgenciesQueryDto extends (0, zod_validation_pipe_1.createZodDto)(exports.complexAgenciesQuerySchema) {
}
exports.ComplexAgenciesQueryDto = ComplexAgenciesQueryDto;
//# sourceMappingURL=dto.js.map