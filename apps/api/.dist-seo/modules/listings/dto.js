"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoBrokerCandidatesQueryDto = exports.coBrokerCandidatesQuerySchema = exports.RecentViewsClearQueryDto = exports.RecentViewsQueryDto = exports.PaginationQueryDto = exports.CoBrokerJoinDto = exports.ListingPhotosDto = exports.ListingVerificationDto = exports.ListingStatusChangeDto = exports.UpdateListingDto = exports.CreateListingDto = exports.AgencyListingListQueryDto = exports.ListingListQueryDto = exports.MapSearchQueryDto = exports.CoBrokerParamDto = exports.IdParamDto = void 0;
const shared_1 = require("@house/shared");
const zod_1 = require("zod");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
class IdParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.idParamSchema) {
}
exports.IdParamDto = IdParamDto;
class CoBrokerParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.coBrokerParamSchema) {
}
exports.CoBrokerParamDto = CoBrokerParamDto;
class MapSearchQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.mapSearchQuerySchema) {
}
exports.MapSearchQueryDto = MapSearchQueryDto;
class ListingListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.listingListQuerySchema) {
}
exports.ListingListQueryDto = ListingListQueryDto;
class AgencyListingListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyListingListQuerySchema) {
}
exports.AgencyListingListQueryDto = AgencyListingListQueryDto;
class CreateListingDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.listingDraftSchema) {
}
exports.CreateListingDto = CreateListingDto;
class UpdateListingDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.listingUpdateSchema) {
}
exports.UpdateListingDto = UpdateListingDto;
class ListingStatusChangeDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.listingStatusChangeSchema) {
}
exports.ListingStatusChangeDto = ListingStatusChangeDto;
class ListingVerificationDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.listingVerificationSchema) {
}
exports.ListingVerificationDto = ListingVerificationDto;
class ListingPhotosDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.listingPhotosSchema) {
}
exports.ListingPhotosDto = ListingPhotosDto;
class CoBrokerJoinDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.coBrokerJoinSchema) {
}
exports.CoBrokerJoinDto = CoBrokerJoinDto;
class PaginationQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.paginationQuerySchema) {
}
exports.PaginationQueryDto = PaginationQueryDto;
class RecentViewsQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.recentViewsQuerySchema) {
}
exports.RecentViewsQueryDto = RecentViewsQueryDto;
class RecentViewsClearQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.recentViewsClearQuerySchema) {
}
exports.RecentViewsClearQueryDto = RecentViewsClearQueryDto;
/** Optional free-text query param: trimmed, empty → undefined. */
const optionalQueryText = (max) => zod_1.z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), zod_1.z.string().trim().max(max, `${max}자 이내로 입력해 주세요.`).optional());
/**
 * GET /agency/listings/co-broker-candidates?complexId&dong&q&page&pageSize. Defined here, not in
 * @house/shared, while the broker console contract settles (web a-listings `CandidateParams`).
 */
exports.coBrokerCandidatesQuerySchema = shared_1.paginationQuerySchema.extend({
    complexId: zod_1.z.uuid({ error: '단지를 선택해 주세요.' }),
    dong: optionalQueryText(20),
    q: optionalQueryText(50),
});
class CoBrokerCandidatesQueryDto extends (0, zod_validation_pipe_1.createZodDto)(exports.coBrokerCandidatesQuerySchema) {
}
exports.CoBrokerCandidatesQueryDto = CoBrokerCandidatesQueryDto;
//# sourceMappingURL=dto.js.map