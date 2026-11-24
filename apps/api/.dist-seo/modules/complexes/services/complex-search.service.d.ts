import { type ComplexAutocompleteQuery, type ComplexAutocompleteResult, type ComplexSearchQuery, type ComplexSummary, type Paginated } from '@house/shared';
import { CacheService } from '../../../common/cache/cache.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RegionsService } from './regions.service';
/** Escapes LIKE wildcards so user input matches literally. */
export declare function escapeLike(s: string): string;
/** 단지 search (trigram ILIKE/similarity on name + address, 초성 search) and 지역+단지 autocomplete. */
export declare class ComplexSearchService {
    private readonly prisma;
    private readonly cache;
    private readonly config;
    private readonly regions;
    constructor(prisma: PrismaService, cache: CacheService, config: AppConfig, regions: RegionsService);
    search(q: ComplexSearchQuery): Promise<Paginated<ComplexSummary>>;
    autocomplete(q: ComplexAutocompleteQuery): Promise<ComplexAutocompleteResult>;
    private matchRegions;
    private sqlIds;
    private chosungIds;
    private chosungIndex;
    private rowsInOrder;
}
