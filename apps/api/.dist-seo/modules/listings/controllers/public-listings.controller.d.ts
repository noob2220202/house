import type { ListingDetail, ListingPage, MapSearchResult } from '@house/shared';
import type { Response } from 'express';
import type { Principal } from '../../../common/auth/principal';
import { IdParamDto, ListingListQueryDto, MapSearchQueryDto } from '../dto';
import { ListingQueryService } from '../services/listing-query.service';
import { MapSearchService } from '../services/map-search.service';
import { SimilarListingsService, type SimilarListings } from '../services/similar-listings.service';
export declare class MapController {
    private readonly map;
    constructor(map: MapSearchService);
    /** bbox + zoom + filters → 읍면동 clusters / grid clusters / 단지·매물 markers. */
    search(q: MapSearchQueryDto): Promise<MapSearchResult>;
}
export declare class PublicListingsController {
    private readonly listings;
    private readonly similarListings;
    constructor(listings: ListingQueryService, similarListings: SimilarListingsService);
    list(q: ListingListQueryDto): Promise<ListingPage>;
    detail(p: IdParamDto, principal: Principal | undefined): Promise<ListingDetail>;
    /** 비슷한 매물: 같은 단지 · 같은 지역 같은 평형 · 같은 가격대 (first cards + totals). */
    similar(p: IdParamDto): Promise<SimilarListings>;
    /**
     * View beacon of the detail page: counts a deduped view (same viewer key as GET /listings/:id,
     * so the SSR read and the beacon count once) and records the recent view of a signed-in user.
     * Not a member action: it still counts while the member has terms pending (TermsConsentGuard).
     */
    view(p: IdParamDto, principal: Principal | undefined, res: Response): Promise<void>;
}
