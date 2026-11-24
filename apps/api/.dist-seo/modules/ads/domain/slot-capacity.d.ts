import { BannerTargeting } from '@house/shared';
export interface TimeWindow {
    startAt: Date;
    endAt: Date;
}
/**
 * Largest number of `others` running at the same instant inside `window` (half-open intervals:
 * a banner ending at T does not overlap one starting at T). Sweep line, O(n log n).
 */
export declare function peakConcurrency(window: TimeWindow, others: readonly TimeWindow[]): {
    peak: number;
    at: Date | null;
};
/** A banner as far as slot capacity is concerned: its window and where it is shown. */
export interface PlacedWindow extends TimeWindow {
    targeting: BannerTargeting;
    regionCodes: readonly string[];
    complexIds: readonly string[];
}
/**
 * A page a slot is rendered on. `global` = no region/complex context (only ALL banners show);
 * `region` = a page for a 법정동 code; `complex` = a complex page (its 시군구/읍면동 codes).
 */
export type CapacityContext = {
    kind: 'global';
} | {
    kind: 'region';
    regionCode: string;
} | {
    kind: 'complex';
    complexId: string;
    regionCodes: readonly string[];
};
/** Same matching rules as AdServeService.computeBanners (region codes match by prefix). */
export declare function appearsIn(b: Omit<PlacedWindow, keyof TimeWindow>, ctx: CapacityContext): boolean;
/**
 * Every page context the new banner appears in where the set of competing banners can differ.
 * For region pages the competitor set only grows as the code gets deeper, so the target code
 * itself plus the deeper codes other banners target are enough; complex pages only differ from
 * their 읍면동 page when some banner targets that complex.
 */
export declare function candidateContexts(banner: Omit<PlacedWindow, keyof TimeWindow>, others: readonly Omit<PlacedWindow, keyof TimeWindow>[], complexCodes: ReadonlyMap<string, readonly string[]>): CapacityContext[];
/**
 * Worst simultaneous count of `others` inside `window` over the contexts the new banner appears
 * in (the new banner itself not included). `context` is where it happens.
 */
export declare function worstContextConcurrency(window: TimeWindow, banner: Omit<PlacedWindow, keyof TimeWindow>, others: readonly PlacedWindow[], complexCodes: ReadonlyMap<string, readonly string[]>): {
    peak: number;
    at: Date | null;
    context: CapacityContext | null;
};
type Placement = Omit<PlacedWindow, keyof TimeWindow>;
/**
 * True when `next` may show the banner on a page where `prev` did not (so the slot limit must be
 * re-checked). Narrowing (fewer complexes, deeper region codes, ALL → targeted) never grows.
 */
export declare function placementGrows(prev: Placement, next: Placement): boolean;
/** True when `next` is live at some instant `prev` was not (un-pausing, earlier start, later end). */
export declare function windowGrows(prev: TimeWindow & {
    paused: boolean;
}, next: TimeWindow & {
    paused: boolean;
}): boolean;
export {};
