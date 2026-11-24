import { CacheService } from '../../../common/cache/cache.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ComplexPopularityService } from '../../complexes/services/complex-popularity.service';
import { ComplexSearchService } from '../../complexes/services/complex-search.service';
import { RegionsService } from '../../complexes/services/regions.service';
import type { SearchSuggestQuery } from '../dto';
import { HomeStatsService } from './home-stats.service';
export declare const SuggestionType: {
    readonly REGION: "REGION";
    readonly COMPLEX: "COMPLEX";
    readonly AGENCY: "AGENCY";
};
export type SuggestionType = (typeof SuggestionType)[keyof typeof SuggestionType];
/** Item of GET /search/suggest (web w-content `searchSuggestionSchema`). */
export interface SuggestionView {
    type: SuggestionType;
    /** REGION: 법정동 code; COMPLEX / AGENCY: uuid. */
    id: string;
    label: string;
    description: string | null;
    lat: number | null;
    lng: number | null;
}
export interface SuggestResult {
    items: SuggestionView[];
    /** Keywords offered before typing (popular 지역 and 단지 names). */
    popular: string[];
}
/**
 * Autocomplete of the site search fields: 지역 (읍면동/리), 단지 and 중개사무소, in that order,
 * cut to `limit`. 지역 and 단지 reuse the complexes autocomplete (trigram + 초성).
 */
export declare class SearchSuggestService {
    private readonly prisma;
    private readonly cache;
    private readonly config;
    private readonly regions;
    private readonly complexSearch;
    private readonly complexPopularity;
    private readonly homeStats;
    private readonly logger;
    constructor(prisma: PrismaService, cache: CacheService, config: AppConfig, regions: RegionsService, complexSearch: ComplexSearchService, complexPopularity: ComplexPopularityService, homeStats: HomeStatsService);
    suggest(q: SearchSuggestQuery): Promise<SuggestResult>;
    private items;
    /** Approved offices of the service region whose name or address contains the term. */
    private agencies;
    /** Names of the most viewed 지역 this week and the most popular 단지 (deduplicated). */
    private popularKeywords;
}
