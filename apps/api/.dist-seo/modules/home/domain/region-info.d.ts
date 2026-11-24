import type { RegionView } from '@house/shared';
/** How a 지역 (8-digit 읍면동 / 10-digit 리 key) is shown on the home page. */
export interface RegionInfo {
    /** "연향동" / "신대리" */
    name: string;
    /** 법정동 label: the 읍면동 name, or "읍면 리" for a 리 ("해룡면 신대리"). */
    emdName: string;
    /** Parent 읍·면 of a 리 (null for 읍면동). */
    parentName: string | null;
    lat: number | null;
    lng: number | null;
}
/**
 * Indexes the service region's 읍면동 / 리 rows by region key. 읍면동 rows may be stored with 8
 * digits (행안부 list) or 10 digits ending in 00 (Kakao bcode); both map to the 8-digit key.
 */
export declare function regionInfoIndex(regions: readonly RegionView[]): Map<string, RegionInfo>;
