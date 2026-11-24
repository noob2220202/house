import { type AgencySummary, type Paginated, type PaginationQuery } from '@house/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { MediaService } from '../../media/media.service';
import { ListingRegionNamesService } from '../../listings/services/listing-region-names.service';
/** Row of GET /me/favorites/agencies: the public office card + when it was saved. */
export interface FavoriteAgencyView extends AgencySummary {
    emdName: string | null;
    favoritedAt: string;
}
/**
 * 관심 중개사무소 (same semantics as 관심 매물/단지: idempotent PUT/DELETE, scoped by the caller).
 * Only approved, live offices can be saved or listed; rows of offices that later stop being
 * disclosable are kept but hidden.
 */
export declare class FavoriteAgenciesService {
    private readonly prisma;
    private readonly media;
    private readonly regionNames;
    constructor(prisma: PrismaService, media: MediaService, regionNames: ListingRegionNamesService);
    add(userId: string, agencyId: string): Promise<void>;
    remove(userId: string, agencyId: string): Promise<void>;
    list(userId: string, q: PaginationQuery): Promise<Paginated<FavoriteAgencyView>>;
}
