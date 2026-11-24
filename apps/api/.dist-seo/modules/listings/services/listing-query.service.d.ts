import { type ListingDetail, type ListingListQuery, type ListingPage } from '@house/shared';
import type { Principal } from '../../../common/auth/principal';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListingSearchRepository } from '../listing-search.repository';
import { ListingMapper } from '../listing.mapper';
import { FavoritesService } from './favorites.service';
import { ListingViewsService } from './listing-views.service';
import { ListingRegionNamesService } from './listing-region-names.service';
import { ListingSummariesService } from './listing-summaries.service';
import { RecentViewsService } from './recent-views.service';
/** Public read side: sorted/paginated search and the listing detail page. */
export declare class ListingQueryService {
    private readonly prisma;
    private readonly search;
    private readonly mapper;
    private readonly views;
    private readonly recent;
    private readonly favorites;
    private readonly summaries;
    private readonly regionNames;
    private readonly cache;
    constructor(prisma: PrismaService, search: ListingSearchRepository, mapper: ListingMapper, views: ListingViewsService, recent: RecentViewsService, favorites: FavoritesService, summaries: ListingSummariesService, regionNames: ListingRegionNamesService, cache: CacheService);
    list(q: ListingListQuery): Promise<ListingPage>;
    /**
     * Total matches for (filter, bbox): a full count of the matching rows, so it is cached like map
     * tiles (same version namespace, bumped on every public-data write; the TTL bounds staleness).
     * Independent of page and sort, so paging through results reuses it.
     */
    private total;
    /** Public detail of an ACTIVE/RESERVED listing; counts a deduped view and a recent view. */
    detail(id: string, principal: Principal | undefined): Promise<ListingDetail>;
    /**
     * POST /listings/:id/view — the browser-side view beacon: counts a view (same per-viewer dedupe
     * as the detail read, so SSR + beacon count once) and, for a signed-in user, the recent view.
     */
    recordView(id: string, principal: Principal | undefined): Promise<void>;
}
