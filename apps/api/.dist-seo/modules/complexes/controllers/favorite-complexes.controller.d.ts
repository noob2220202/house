import type { FavoriteComplexItem, Paginated } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { IdParamDto, PaginationQueryDto } from '../dto';
import { ComplexFavoritesService } from '../services/complex-favorites.service';
export declare class FavoriteComplexesController {
    private readonly favorites;
    constructor(favorites: ComplexFavoritesService);
    list(user: UserPrincipal, q: PaginationQueryDto): Promise<Paginated<FavoriteComplexItem>>;
    add(user: UserPrincipal, p: IdParamDto): Promise<{
        complexId: string;
        favorited: true;
    }>;
    remove(user: UserPrincipal, p: IdParamDto): Promise<void>;
}
