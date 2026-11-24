import type { ComplexAutocompleteResult, ComplexDetail, ComplexListingsSummary, ComplexStatsView, ComplexSummary, Paginated, PopularComplexItem, TradeView } from '@house/shared';
import type { Principal } from '../../../common/auth/principal';
import { ComplexAgenciesQueryDto, ComplexAutocompleteQueryDto, ComplexNearbyQueryDto, ComplexSearchQueryDto, ComplexStatsQueryDto, ComplexTradesQueryDto, IdParamDto, PopularComplexesQueryDto } from '../dto';
import { ComplexNearbyService, type ComplexAgencyView, type NearbyComplexView } from '../services/complex-nearby.service';
import { ComplexPopularityService } from '../services/complex-popularity.service';
import { ComplexQueryService } from '../services/complex-query.service';
import { ComplexSearchService } from '../services/complex-search.service';
import { ComplexTradesService } from '../services/complex-trades.service';
/** Static routes are declared before `:id` so they are matched first. */
export declare class PublicComplexesController {
    private readonly search;
    private readonly popularity;
    private readonly query;
    private readonly trades;
    private readonly neighbourhood;
    constructor(search: ComplexSearchService, popularity: ComplexPopularityService, query: ComplexQueryService, trades: ComplexTradesService, neighbourhood: ComplexNearbyService);
    list(q: ComplexSearchQueryDto): Promise<Paginated<ComplexSummary>>;
    /** 지역(읍면동·리) + 단지명 suggestions; supports 초성 ("ㅇㅎ"). */
    autocomplete(q: ComplexAutocompleteQueryDto): Promise<ComplexAutocompleteResult>;
    /** 자주 찾는 단지: 30-day time-decayed views, with active listing counts per deal type. */
    popular(q: PopularComplexesQueryDto): Promise<PopularComplexItem[]>;
    detail(p: IdParamDto, principal: Principal | undefined): Promise<ComplexDetail>;
    tradeList(p: IdParamDto, q: ComplexTradesQueryDto): Promise<Paginated<TradeView>>;
    stats(p: IdParamDto, q: ComplexStatsQueryDto): Promise<ComplexStatsView>;
    listings(p: IdParamDto): Promise<ComplexListingsSummary>;
    /** 주변 단지 within `radius` m (default 3 km), nearest first, with listing counts per deal type. */
    nearby(p: IdParamDto, q: ComplexNearbyQueryDto): Promise<{
        items: NearbyComplexView[];
    }>;
    /** Offices with public listings in this 단지, most listings first. */
    agencies(p: IdParamDto, q: ComplexAgenciesQueryDto): Promise<{
        items: ComplexAgencyView[];
    }>;
}
