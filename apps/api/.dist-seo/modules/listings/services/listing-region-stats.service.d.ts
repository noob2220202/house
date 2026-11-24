import { AssetType } from '@house/shared';
import { PrismaService } from '../../../prisma/prisma.service';
/** Active listings per deal type (분양권 / 매매 / 전세 / 월세). */
export interface DealCounts {
    presale: number;
    sale: number;
    jeonse: number;
    monthly: number;
}
export interface RegionListingStat {
    /** 8-digit 읍면동 or 10-digit 리 code (domain/region-key). */
    regionKey: string;
    listingCount: number;
    dealCounts: DealCounts;
    /** Mean position of the region's listings (fallback when the region has no centroid). */
    lat: number;
    lng: number;
}
/**
 * Which listings an average 평당가 (만원/평) is computed from — only where Korean listings are
 * compared that way: 아파트 (공급 평당, 전용 when 공급 is unknown), 토지 (대지 평당), 상가 (전용 평당).
 */
export declare const PerPyeongBasis: {
    readonly APT: "APT";
    readonly LAND: "LAND";
    readonly COMMERCIAL: "COMMERCIAL";
};
export type PerPyeongBasis = (typeof PerPyeongBasis)[keyof typeof PerPyeongBasis];
export interface ListingTotals {
    listingCount: number;
    assetTypeCounts: Record<AssetType, number>;
    /** Listings whose latest 실매물 확인 is at or after `verifiedSince`. */
    verifiedCount: number;
}
export declare function emptyDealCounts(): DealCounts;
/**
 * Read-only aggregates over publicly visible listings per 지역 (home 지역 현황 / 많이 찾는 지역).
 * Same disclosure rule as public search: 광고중/계약중, not deleted, approved primary agency.
 */
export declare class ListingRegionStatsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    /** Listing counts per 지역 (and deal type) within the 시군구, optionally for some asset types. */
    regionStats(sggCode: string, assetTypes?: readonly AssetType[]): Promise<RegionListingStat[]>;
    /** Average 매매 평당가 (만원/평, rounded) per 지역 for one basis. */
    perPyeongByRegion(sggCode: string, basis: PerPyeongBasis): Promise<Map<string, number>>;
    /** City-wide counters of the home hero. */
    totals(sggCode: string, verifiedSince: Date): Promise<ListingTotals>;
}
