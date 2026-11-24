/**
 * 법정동 reference data for 전남광주통합특별시 순천시 (시군구 12150): 33 동 + 1 읍 10 면 and their 리.
 * Source: 행정안전부 법정동코드 전체자료 (active codes). 읍면동 codes are 8 digits, 리 codes 10.
 * On 2026-07-01 전라남도 순천시 (46150) became 전남광주통합특별시 순천시 (12150); only the
 * 시도·시군구 digits changed, so every code below is the former code with 46150 → 12150
 * (왕지동 46150132 → 12150132, 신대리 4615031022 → 1215031022).
 * When REGION_SGG_CODE does not match SUNCHEON_SGG_CODE the bundled seed refuses to run and
 * regions are maintained through PUT /api/v1/admin/regions/:code instead.
 */
export declare const SUNCHEON_SGG_CODE = "12150";
export declare const SUNCHEON_SIDO: {
    readonly code: "12";
    readonly name: "전남광주통합특별시";
};
export declare const SUNCHEON_SGG: {
    readonly name: "순천시";
    readonly fullName: "전남광주통합특별시 순천시";
    readonly lat: 34.950637;
    readonly lng: 127.487214;
};
/** [code, name] in 법정동코드 order. */
export declare const SUNCHEON_REGIONS: readonly (readonly [string, string])[];
