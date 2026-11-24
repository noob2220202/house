/**
 * 법정동 codes are hierarchical by prefix (시도 2 / 시군구 5 / 읍면동 8 / 리 10 digits), so a banner
 * targeting "12150" matches a context of "1215010100". Returns every ancestor code of the inputs
 * (legacy 46150… codes are canonicalized first, like every stored code).
 */
export declare function regionCodePrefixes(codes: readonly (string | null | undefined)[]): string[];
