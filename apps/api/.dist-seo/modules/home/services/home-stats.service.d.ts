import { AssetType } from '@house/shared';
import { CacheService } from '../../../common/cache/cache.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RegionsService } from '../../complexes/services/regions.service';
import { ListingRegionStatsService, PerPyeongBasis, type DealCounts } from '../../listings/services/listing-region-stats.service';
import { ListingViewsService, type RegionViews } from '../../listings/services/listing-views.service';
import type { PopularRegionsQuery } from '../dto';
/** Region row of GET /home/summary (web w-home `homeRegionSchema`). */
export interface HomeRegionView {
    code: string;
    /** Display name: "연향동" / "신대리". */
    name: string;
    /** 법정동 label: "연향동" / "해룡면 신대리". */
    emdName: string | null;
    lat: number;
    lng: number;
    listingCount: number;
    /** 매매 평당가 (만원/평), null where the category is not compared that way. */
    avgPricePerPyeong: number | null;
}
/** GET /home/summary (web `homeSummarySchema`). */
export interface HomeSummaryView {
    regionName: string | null;
    listingCount: number;
    agencyCount: number;
    /** Listings with a 실매물 확인 today (KST). */
    verifiedTodayCount: number;
    assetTypeCounts: Record<AssetType, number>;
    /** 지역 with public listings, most listings first. */
    regions: HomeRegionView[];
    updatedAt: string;
}
/** Item of GET /home/popular-regions (web `popularRegionSchema`). */
export interface PopularRegionView extends HomeRegionView {
    rank: number;
    /** + moved up, − moved down, 0 flat, null = not ranked the week before. */
    rankDelta: number | null;
    dealCounts: DealCounts;
    /** Counted listing views of the region in the last 7 KST days (selected categories). */
    weeklyViewCount: number;
}
export interface PopularRegionsView {
    items: PopularRegionView[];
    updatedAt: string;
}
/**
 * Basis of the 평당가 for a category selection (web mock `perPyeongFor`): 아파트 whenever all
 * categories or 아파트 are selected, else 토지, else 상가; 원룸·주택 alone → none.
 */
export declare function perPyeongBasisFor(assetTypes: readonly AssetType[] | undefined): PerPyeongBasis | null;
/** Views of the selected categories per region key. */
export declare function viewsFor(views: RegionViews, assetTypes: readonly AssetType[] | undefined): Map<string, number>;
/**
 * Ranks region keys by this week's views (ties: more listings, then key) and computes the rank
 * change against last week's ranking of the same candidates (null when unranked last week).
 */
export declare function rankRegions(candidates: readonly {
    key: string;
    listingCount: number;
}[], thisWeek: ReadonlyMap<string, number>, lastWeek: ReadonlyMap<string, number>): {
    key: string;
    rank: number;
    rankDelta: number | null;
    weeklyViewCount: number;
}[];
/** Home hero counters and the 지역 ranking, from public listings + region view counters. */
export declare class HomeStatsService {
    private readonly prisma;
    private readonly cache;
    private readonly config;
    private readonly regions;
    private readonly stats;
    private readonly views;
    constructor(prisma: PrismaService, cache: CacheService, config: AppConfig, regions: RegionsService, stats: ListingRegionStatsService, views: ListingViewsService);
    private get sggCode();
    summary(now?: Date): Promise<HomeSummaryView>;
    popularRegions(q: PopularRegionsQuery, now?: Date): Promise<PopularRegionsView>;
    /** Display name of the service 시군구 ("순천시"). */
    regionName(): Promise<string | null>;
    private regionIndex;
    private computeSummary;
    private computePopularRegions;
}
