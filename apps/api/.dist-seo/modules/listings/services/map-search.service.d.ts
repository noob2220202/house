import { type MapSearchQuery, type MapSearchResult } from '@house/shared';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListingSearchRepository } from '../listing-search.repository';
/**
 * Map search: 읍면동 clusters (low zoom), tile-aligned grid clusters (mid zoom), or 단지 + 개별 매물
 * markers (high zoom). Results are computed for the tile-aligned bbox and cached briefly in Redis.
 */
export declare class MapSearchService {
    private readonly repo;
    private readonly prisma;
    private readonly cache;
    constructor(repo: ListingSearchRepository, prisma: PrismaService, cache: CacheService);
    search(q: MapSearchQuery): Promise<MapSearchResult>;
    private compute;
    private regionClusters;
    private gridClusters;
}
