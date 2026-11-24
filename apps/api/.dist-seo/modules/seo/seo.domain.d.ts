import { type RegionView } from '@house/shared';
import type { SeoJeonseSummary, SeoSaleSummary } from './seo.types';
/** 읍면동 rows may be stored with 10 digits ending in 00 (Kakao bcode); the key is 8 digits. */
export declare function regionKeyOf(code: string | null | undefined): string | null;
export interface RegionEntry {
    code: string;
    name: string;
    emdName: string;
    parentName: string | null;
    lat: number | null;
    lng: number | null;
    /** 법정동코드 order. */
    order: number;
}
/** Indexes the 읍면동 / 리 rows of the service 시군구 by region key (the 8-digit row wins). */
export declare function buildRegionIndex(regions: readonly RegionView[]): Map<string, RegionEntry>;
/**
 * Resolves a 국토교통부 법정동 name ("신대리", "해룡면 신대리", "연향동") to a region key. A bare 리
 * name shared by two 읍·면 is ambiguous and resolves to null (never guess).
 */
export declare function regionNameResolver(index: ReadonlyMap<string, RegionEntry>): (emdName: string | null | undefined) => string | null;
export declare function median(values: readonly number[]): number | null;
export interface SaleRow {
    /** 거래금액 (만원) */
    price: number;
    /** 전용면적 ㎡ */
    exclusiveArea: number;
}
/** Count, mean, median, range and 전용 평당가 of non-cancelled 매매 rows. */
export declare function summarizeSales(rows: readonly SaleRow[]): SeoSaleSummary;
export declare function summarizeDeposits(deposits: readonly number[]): SeoJeonseSummary;
/** The last 12 KST months including the current one. */
export declare function tradeWindow(currentYm: number): {
    fromYm: number;
    toYm: number;
};
/**
 * Month the report shows by default: the newest month before the current KST month that has
 * trades (the current month is still being reported — 신고 기한 30일), else the newest month.
 */
export declare function latestReportMonth(available: readonly number[], currentYm: number): number | null;
export interface ReportTradeRow extends SaleRow {
    emdName: string | null;
    /** Region key of the matched 단지 (more reliable than the reported 법정동 name). */
    complexRegionKey: string | null;
    complexId: string | null;
    complexName: string | null;
    aptName: string;
}
/** Groups a month's 매매 rows per 법정동 (matched 단지 region first, else the reported name). */
export declare function groupByRegion(rows: readonly ReportTradeRow[], index: ReadonlyMap<string, RegionEntry>, resolve: (emdName: string | null) => string | null): {
    regionCode: string | null;
    name: string;
    rows: ReportTradeRow[];
}[];
/** 단지 with the most trades (matched 단지 id, else the reported 단지명 + 법정동). */
export declare function topComplexes(rows: readonly ReportTradeRow[], limit: number): {
    complexId: string | null;
    name: string;
    emdName: string | null;
    prices: number[];
}[];
