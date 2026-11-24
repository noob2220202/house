/**
 * Grouping key of a listing's 법정동 for region aggregates (home 지역 ranking, 비슷한 매물):
 * the 8-digit 읍면동 code, or the 10-digit code of a 리. A 10-digit 읍면동 code ("1215011400",
 * as sent by the Kakao postcode `bcode`) collapses to its 8-digit form so both spellings of the
 * same 동 land in one group. null for missing / 시군구-level codes.
 */
export declare function regionKeyOf(emdCode: string | null | undefined): string | null;
/** Codes a listing of region `key` may carry in `listings.emd_code` (8- and 10-digit spellings). */
export declare function emdCodesOfRegionKey(key: string): string[];
