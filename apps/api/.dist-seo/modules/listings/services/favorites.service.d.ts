import { type FavoriteListingItem, type Paginated, type PaginationQuery } from '@house/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListingSummariesService } from './listing-summaries.service';
export declare class FavoritesService {
    private readonly prisma;
    private readonly summaries;
    constructor(prisma: PrismaService, summaries: ListingSummariesService);
    /** Idempotent: favoriting twice keeps one row and counts once. */
    add(userId: string, listingId: string): Promise<{
        listingId: string;
        favorited: true;
    }>;
    remove(userId: string, listingId: string): Promise<void>;
    list(userId: string, q: PaginationQuery): Promise<Paginated<FavoriteListingItem>>;
    isFavorite(userId: string, listingId: string): Promise<boolean>;
}
