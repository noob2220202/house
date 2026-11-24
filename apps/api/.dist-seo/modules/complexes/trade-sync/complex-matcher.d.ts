export interface MatchableComplex {
    id: string;
    name: string;
    emdName: string | null;
    jibun: string | null;
    jibunAddress: string | null;
    externalCode: string | null;
    areaTypes: readonly {
        id: string;
        exclusiveArea: number;
    }[];
}
export interface TradeIdentity {
    aptSeq: string | null;
    aptName: string;
    emdName: string | null;
    jibun: string | null;
}
/**
 * Matches 실거래 rows to 단지, most specific signal first:
 *   1. aptSeq = complexes.external_code
 *   2. 법정동 + 지번 (disambiguated by name when several 단지 share a 지번)
 *   3. 법정동 + normalized name variants
 *   4. normalized name, when unique in the 시군구 and the 법정동 does not contradict
 * Steps 2-4 drop candidates contradicted by a stronger signal (a different 국토교통부 code or a
 * different 지번), so same-named 단지 (현대, 부영, 주공…) never absorb each other's trades.
 * Ambiguous candidates never match: an unmatched trade is better than a wrong one.
 */
export declare class ComplexMatcher {
    private readonly bySeq;
    private readonly byEmdJibun;
    private readonly byEmdName;
    private readonly byName;
    private readonly byId;
    constructor(complexes: readonly MatchableComplex[]);
    match(t: TradeIdentity): MatchableComplex | null;
    /**
     * Where a trade belongs now: the current match, else the 단지 it is attached to as long as
     * keeps() allows (rows matched earlier are not dropped just because a name became ambiguous).
     */
    resolve(t: TradeIdentity, currentComplexId: string | null): MatchableComplex | null;
    /** The indexed (live) 단지 with this id, if any. */
    get(complexId: string): MatchableComplex | null;
    /**
     * Whether a trade currently attached to `complexId` should stay there: false when the 단지 is
     * unknown (deleted) or a strong signal contradicts it. Weak ambiguity alone never detaches.
     */
    keeps(complexId: string, t: Pick<TradeIdentity, 'aptSeq' | 'jibun'>): boolean;
    /** Nearest 평형 by 전용면적 within the tolerance (ties → first declared). */
    static areaTypeFor(complex: MatchableComplex, exclusiveArea: number): string | null;
    private distinct;
}
