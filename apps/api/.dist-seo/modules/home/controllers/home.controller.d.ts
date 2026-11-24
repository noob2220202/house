import { PopularRegionsQueryDto } from '../dto';
import { HomeStatsService, type HomeSummaryView, type PopularRegionsView } from '../services/home-stats.service';
export declare class HomeController {
    private readonly stats;
    constructor(stats: HomeStatsService);
    /** Site-wide counters + 지역 현황 of the home hero (cached ~2 min). */
    summary(): Promise<HomeSummaryView>;
    /** 많이 찾는 지역: 읍면동/리 by this week's listing views, with listing counts per deal type. */
    popularRegions(q: PopularRegionsQueryDto): Promise<PopularRegionsView>;
}
