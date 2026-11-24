import {
  agencyListingListQuerySchema,
  coBrokerJoinSchema,
  coBrokerParamSchema,
  idParamSchema,
  listingDraftSchema,
  listingListQuerySchema,
  listingPhotosSchema,
  listingStatusChangeSchema,
  listingUpdateSchema,
  listingVerificationSchema,
  mapSearchQuerySchema,
  paginationQuerySchema,
  recentViewsClearQuerySchema,
  recentViewsQuerySchema,
} from '@house/shared';
import { z } from 'zod';
import { createZodDto } from '../../common/pipes/zod-validation.pipe';

export class IdParamDto extends createZodDto(idParamSchema) {}
export class CoBrokerParamDto extends createZodDto(coBrokerParamSchema) {}
export class MapSearchQueryDto extends createZodDto(mapSearchQuerySchema) {}
export class ListingListQueryDto extends createZodDto(listingListQuerySchema) {}
export class AgencyListingListQueryDto extends createZodDto(agencyListingListQuerySchema) {}
export class CreateListingDto extends createZodDto(listingDraftSchema) {}
export class UpdateListingDto extends createZodDto(listingUpdateSchema) {}
export class ListingStatusChangeDto extends createZodDto(listingStatusChangeSchema) {}
export class ListingVerificationDto extends createZodDto(listingVerificationSchema) {}
export class ListingPhotosDto extends createZodDto(listingPhotosSchema) {}
export class CoBrokerJoinDto extends createZodDto(coBrokerJoinSchema) {}
export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}
export class RecentViewsQueryDto extends createZodDto(recentViewsQuerySchema) {}
export class RecentViewsClearQueryDto extends createZodDto(recentViewsClearQuerySchema) {}

/** Optional free-text query param: trimmed, empty → undefined. */
const optionalQueryText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(max, `${max}자 이내로 입력해 주세요.`).optional(),
  );

/**
 * GET /agency/listings/co-broker-candidates?complexId&dong&q&page&pageSize. Defined here, not in
 * @house/shared, while the broker console contract settles (web a-listings `CandidateParams`).
 */
export const coBrokerCandidatesQuerySchema = paginationQuerySchema.extend({
  complexId: z.uuid({ error: '단지를 선택해 주세요.' }),
  dong: optionalQueryText(20),
  q: optionalQueryText(50),
});
export type CoBrokerCandidatesQuery = z.infer<typeof coBrokerCandidatesQuerySchema>;
export class CoBrokerCandidatesQueryDto extends createZodDto(coBrokerCandidatesQuerySchema) {}
