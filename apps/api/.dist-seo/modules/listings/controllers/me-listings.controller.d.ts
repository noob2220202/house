import type { FavoriteListingItem, Paginated, RecentViewItem } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { IdParamDto, PaginationQueryDto, RecentViewsClearQueryDto, RecentViewsQueryDto } from '../dto';
import { FavoritesService } from '../services/favorites.service';
import { RecentViewsService } from '../services/recent-views.service';
export declare class FavoriteListingsController {
    private readonly favorites;
    constructor(favorites: FavoritesService);
    list(user: UserPrincipal, q: PaginationQueryDto): Promise<Paginated<FavoriteListingItem>>;
    add(user: UserPrincipal, p: IdParamDto): Promise<{
        listingId: string;
        favorited: true;
    }>;
    remove(user: UserPrincipal, p: IdParamDto): Promise<void>;
}
export declare class RecentViewsController {
    private readonly recent;
    constructor(recent: RecentViewsService);
    list(user: UserPrincipal, q: RecentViewsQueryDto): Promise<Paginated<RecentViewItem>>;
    clear(user: UserPrincipal, q: RecentViewsClearQueryDto): Promise<void>;
}
