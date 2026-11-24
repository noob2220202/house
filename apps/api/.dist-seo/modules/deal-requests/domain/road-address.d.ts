/**
 * "전남 순천시 해룡면 신대2로 40 (신대리)" → "신대2로40": the road name + building number, which
 * identify a building whatever the 시도 / 시군구 spelling (전남 / 전라남도 / 전남광주통합특별시,
 * 46150 → 12150) or trailing extras (동, 참고항목). Null when no "…로|길 <번호>" part is found.
 */
export declare function roadKey(address: string | null | undefined): string | null;
/** Road name of a road key ("신대2로40" → "신대2로"), used to narrow the DB lookup. */
export declare function roadNameOf(address: string | null | undefined): string | null;
/** "레이크파크 1단지" → "레이크파크1단지": building names compared without spaces / punctuation. */
export declare function nameKey(name: string | null | undefined): string;
