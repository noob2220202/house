import { type ListingSummary } from '@house/shared';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListingRegionNamesService } from './listing-region-names.service';
import { ListingSummariesService } from './listing-summaries.service';
export declare const SimilarGroupKey: {
    readonly SAME_COMPLEX: "SAME_COMPLEX";
    readonly SAME_AREA: "SAME_AREA";
    readonly SAME_PRICE: "SAME_PRICE";
};
export type SimilarGroupKey = (typeof SimilarGroupKey)[keyof typeof SimilarGroupKey];
export interface SimilarListingGroup {
    key: SimilarGroupKey;
    label: string;
    /** Every match of the group (the cards are the first SIMILAR_GROUP_SIZE). */
    total: number;
    items: ListingSummary[];
}
/** GET /listings/:id/similar (web `similarListingsSchema`). */
export interface SimilarListings {
    /** "연향동 · 매매 · 34평 · 3.2억~4.8억" */
    criteria: string | null;
    regionName: string | null;
    /** Public listings in the listing's 지역 (any type) — "연향동 매물 N개 더 보기". */
    regionListingCount: number | null;
    /** Groups with at least one card, in SAME_COMPLEX → SAME_AREA → SAME_PRICE order. */
    groups: SimilarListingGroup[];
}
export declare const SIMILAR_GROUP_SIZE = 8;
/** 만원 → "4.5억" / "9,500만". */
export declare function formatManwon(v: number): string;
/** [lo, hi] price band of 같은 가격대, or null without a price. */
export declare function priceBand(price: number | null): [number, number] | null;
/** 비슷한 매물 of a public listing: 같은 단지 · 같은 지역 같은 평형 · 같은 가격대. */
export declare class SimilarListingsService {
    private readonly prisma;
    private readonly summaries;
    private readonly regionNames;
    private readonly cache;
    constructor(prisma: PrismaService, summaries: ListingSummariesService, regionNames: ListingRegionNamesService, cache: CacheService);
    similar(id: string): Promise<SimilarListings>;
    private compute;
    private group;
}
