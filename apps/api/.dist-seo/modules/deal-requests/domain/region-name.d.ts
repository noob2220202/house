/** A `regions` row as needed to name a 법정동 code. */
export interface RegionNameRow {
    code: string;
    name: string;
    level: string;
    parent: {
        name: string;
    } | null;
}
/**
 * Codes under which a 법정동 may be stored: the code itself, its 8-digit 읍면동 prefix and that
 * prefix padded to 10 digits (regions holds 읍면동 rows as 8- or 10-digit codes).
 */
export declare function regionNameCandidates(code: string): string[];
/**
 * Display name of a 법정동 code: the 읍면동 ("조례동"), "읍면 리" for a 리 ("해룡면 신대리"); a 리
 * code without its own row falls back to the 읍면동. Null when unknown or shorter than 8 digits.
 */
export declare function regionNameOf(code: string | null | undefined, byCode: ReadonlyMap<string, RegionNameRow>): string | null;
