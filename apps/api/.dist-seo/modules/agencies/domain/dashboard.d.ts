import { DealType, type AssetType, type FloorDisplay } from '@house/shared';
/** KST calendar day "YYYY-MM-DD" of an instant. */
export declare function kstDay(at: Date): string;
/** "YYYY-MM-DD" shifted by `days`. */
export declare function addDays(day: string, days: number): string;
/** "YYYY-MM-DD" → Date at UTC midnight (for @db.Date columns). */
export declare function dayToDate(day: string): Date;
export interface DailyViews {
    total7d: number;
    /** vs the previous 7 days (0.12 = +12%); null when there is nothing to compare with. */
    changeRatio: number | null;
    /** Oldest → newest, 7 entries ending today. */
    daily: {
        date: string;
        views: number;
    }[];
}
/**
 * Views per day from cumulative snapshots (`day → total listing views`): views(D) =
 * snap(D) − snap(D−1), clamped at 0 (a listing leaving the agency lowers the sum). A day whose own
 * or previous snapshot is missing counts 0 — the all-time total never lands on one day.
 */
export declare function dailyViews(snapshots: ReadonlyMap<string, number>, today: string): DailyViews;
export interface DashboardListingRow {
    id: string;
    title: string | null;
    assetType: AssetType;
    dealType: DealType;
    salePrice: number | null;
    deposit: number | null;
    monthlyRent: number | null;
    presalePrice: number | null;
    premium: number | null;
    floorDisplay: FloorDisplay;
    expiresAt: Date | null;
    verifiedAt: Date | null;
    complex: {
        name: string;
    } | null;
    property: {
        floor: number | null;
        totalFloors: number | null;
        exclusiveArea: number | null;
        supplyArea: number | null;
    };
}
/** Row of the dashboard's 광고 만료 임박 / 실매물 확인 lists (web `dashboardListingSchema`). */
export interface DashboardListing {
    id: string;
    title: string;
    summary: string | null;
    dealType: DealType;
    price: number | null;
    deposit: number | null;
    monthlyRent: number | null;
    expiresAt: string | null;
    verifiedAt: string | null;
    verificationDueAt: string | null;
}
/** "34평 · 5/15층": 평 from 공급면적 (else 전용), floor as the agency may show it. */
export declare function listingSummaryText(r: DashboardListingRow): string | null;
/**
 * Price fields as the console shows them (만원): 매매 / 분양권 (분양가 + 프리미엄) → `price`,
 * 전세 → `deposit`, 월세 → `deposit` + `monthlyRent`.
 */
export declare function dashboardPrice(r: Pick<DashboardListingRow, 'dealType' | 'salePrice' | 'deposit' | 'monthlyRent' | 'presalePrice' | 'premium'>): Pick<DashboardListing, 'price' | 'deposit' | 'monthlyRent'>;
/**
 * `verificationValidDays` after the last 실매물 확인 the badge (and, here, the ad period) lapses
 * unless the listing is verified again. KST date; null when never verified.
 */
export declare function toDashboardListing(r: DashboardListingRow, verificationValidDays: number): DashboardListing;
