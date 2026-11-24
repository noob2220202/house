/** A regions row as needed to name a listing's 법정동. */
export interface RegionNameRow {
    code: string;
    name: string;
    level: string;
    parent: {
        name: string;
    } | null;
}
/**
 * Codes under which the 읍면동 of `emdCode` may be stored: the code itself, its 8-digit 읍면동
 * prefix and that prefix padded to 10 digits (regions holds 읍면동 rows as 8- or 10-digit codes).
 */
export declare function emdNameCandidates(emdCode: string): string[];
/**
 * Display name of a listing's 법정동: the 읍면동 name ("조례동"), or "읍면 리" for a 리 code
 * ("해룡면 신대리"). A 리 code without its own row falls back to the 읍면동 name. null when the
 * code is not in the regions table.
 */
export declare function emdNameOf(emdCode: string | null, byCode: ReadonlyMap<string, RegionNameRow>): string | null;
