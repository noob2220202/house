import type { Paginated } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { IdParamDto, InterestRegionsInputDto, PaginationQueryDto } from '../dto';
import { FavoriteAgenciesService, type FavoriteAgencyView } from '../services/favorite-agencies.service';
import { InterestRegionsService, type InterestRegionsView } from '../services/interest-regions.service';
/** 관심 중개사무소 (same contract as 관심 매물/단지: id list via GET, idempotent PUT/DELETE). */
export declare class FavoriteAgenciesController {
    private readonly favorites;
    constructor(favorites: FavoriteAgenciesService);
    list(user: UserPrincipal, q: PaginationQueryDto): Promise<Paginated<FavoriteAgencyView>>;
    add(user: UserPrincipal, p: IdParamDto): Promise<void>;
    remove(user: UserPrincipal, p: IdParamDto): Promise<void>;
}
/** 관심 지역 (signup step + MY). */
export declare class InterestRegionsController {
    private readonly interest;
    constructor(interest: InterestRegionsService);
    get(user: UserPrincipal): Promise<InterestRegionsView>;
    put(user: UserPrincipal, dto: InterestRegionsInputDto): Promise<InterestRegionsView>;
}
