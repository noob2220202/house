import { type FavoriteComplexItem, type Paginated, type PaginationQuery } from '@house/shared';
import { PrismaService } from '../../../prisma/prisma.service';
/** 관심 단지. Rows are always scoped by the caller's userId (no IDOR). */
export declare class ComplexFavoritesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    /** Idempotent: favoriting twice keeps one row and counts once. */
    add(userId: string, complexId: string): Promise<{
        complexId: string;
        favorited: true;
    }>;
    remove(userId: string, complexId: string): Promise<void>;
    list(userId: string, q: PaginationQuery): Promise<Paginated<FavoriteComplexItem>>;
    isFavorite(userId: string, complexId: string): Promise<boolean>;
}
