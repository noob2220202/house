import { DealRequestType, DealType, type AssetType } from '@house/shared';
/** The request conditions a listing is ranked against (agency view of the request). */
export interface MatchRequest {
    type: DealRequestType;
    assetType: AssetType;
    dealTypes: readonly DealType[];
    emdCode: string | null;
    complexId: string | null;
    regionCodes: readonly string[];
    complexIds: readonly string[];
    priceMin: number | null;
    priceMax: number | null;
    depositMin: number | null;
    depositMax: number | null;
    rentMin: number | null;
    rentMax: number | null;
    areaMin: number | null;
    areaMax: number | null;
    roomsMin: number | null;
}
/** Listing fields used for ranking (console money convention: price = 매매/전세/분양권). */
export interface MatchListing {
    assetType: AssetType;
    dealType: DealType;
    price: number | null;
    deposit: number | null;
    monthlyRent: number | null;
    exclusiveArea: number | null;
    rooms: number | null;
    emdCode: string | null;
    complexId: string | null;
}
/**
 * How well one of the agency's listings fits a request: the number of satisfied conditions
 * (asset type, deal type, region / complex, budget, area, rooms) and whether all stated ones
 * are. Same rule as the web picker
 * (`a-inbox/lib/match.ts`), so the server order and the "조건 일치" hint agree. A hint, never a
 * filter: every active listing may be attached.
 */
export declare function matchScore(r: MatchRequest, l: MatchListing): {
    full: boolean;
    score: number;
};
/** Full matches first, then by score; ties keep the incoming order (stable sort). */
export declare function rankByMatch<T extends MatchListing>(r: MatchRequest, listings: readonly T[]): T[];
