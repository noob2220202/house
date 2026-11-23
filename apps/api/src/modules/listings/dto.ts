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
