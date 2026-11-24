import type { AssetType, DealType, ListingStatus } from '@house/shared';
/** One 지역 (8-digit 읍면동 or 10-digit 리 key) with what the site has for it. */
export interface SeoRegionView {
    /** Region key: 8-digit 읍면동 ("12150114") or 10-digit 리 ("1215037021"). */
    code: string;
    /** "연향동" / "신대리" */
    name: string;
    /** 법정동 label: "연향동" / "해룡면 신대리". */
    emdName: string;
    /** Parent 읍·면 of a 리 (null for 읍면동). */
    parentName: string | null;
    lat: number | null;
    lng: number | null;
    /** Publicly visible listings (광고중/계약중, approved primary office) per asset type. */
    listingCounts: Record<AssetType, number>;
    /** 아파트·오피스텔 단지 (not deleted) located in the region. */
    complexCount: number;
    /** Non-cancelled 아파트 매매 실거래 within `tradePeriod`. */
    saleTradeCount: number;
    /** Latest change among the region's public listings, 단지 and trades (ISO) — sitemap lastmod. */
    lastModified: string | null;
}
/** GET /seo/regions */
export interface SeoRegionIndexView {
    sggCode: string;
    /** "순천시" */
    regionName: string;
    /** Inclusive YYYYMM window `saleTradeCount` covers (the last 12 KST months incl. the current one). */
    tradePeriod: {
        fromYm: number;
        toYm: number;
    };
    /** Only 지역 with at least one listing, 단지 or trade; 법정동코드 order. */
    regions: SeoRegionView[];
    updatedAt: string;
}
/** Listings of one deal type in a landing (prices = 매매가 / 분양가+프리미엄 / 보증금). */
export interface SeoDealSummary {
    dealType: DealType;
    count: number;
    minPrice: number | null;
    maxPrice: number | null;
    avgPrice: number | null;
    /** 월세 range (월세 rows only). */
    minRent: number | null;
    maxRent: number | null;
}
/** Non-cancelled 매매 trades of a period. */
export interface SeoSaleSummary {
    count: number;
    avgPrice: number | null;
    medianPrice: number | null;
    minPrice: number | null;
    maxPrice: number | null;
    /** 전용면적 3.3㎡(1평)당 평균 거래가 (만원). */
    avgPricePerPyeong: number | null;
}
/** Non-cancelled 전세 trades of a period (보증금). */
export interface SeoJeonseSummary {
    count: number;
    avgDeposit: number | null;
    medianDeposit: number | null;
}
export interface SeoTradeItem {
    /** 계약일 YYYY-MM-DD */
    dealDate: string;
    /** Matched 단지 (null when the trade could not be matched to a 단지 page). */
    complexId: string | null;
    /** 단지명 as reported by 국토교통부. */
    aptName: string;
    /** 전용면적 ㎡ */
    exclusiveArea: number;
    floor: number | null;
    /** 거래금액 (만원) */
    price: number;
}
export interface SeoComplexItem {
    id: string;
    name: string;
    assetType: AssetType;
    households: number | null;
    builtYear: number | null;
    /** 사용승인일 YYYY-MM-DD */
    approvalDate: string | null;
    activeListingCount: number;
    /** Latest non-cancelled 매매 실거래 of the 단지. */
    latestSale: {
        price: number;
        dealDate: string;
        exclusiveArea: number;
        floor: number | null;
    } | null;
}
/** GET /seo/regions/:code/landing?assetTypes */
export interface SeoRegionLandingView {
    region: SeoRegionView;
    assetTypes: AssetType[];
    listings: {
        total: number;
        byDealType: SeoDealSummary[];
        /** Most recent 공개일 among them (ISO). */
        lastPublishedAt: string | null;
    };
    /** 단지 of the region for the requested 아파트/오피스텔 types (most listings, then 세대수). */
    complexes: SeoComplexItem[];
    complexTotal: number;
    /** 아파트 실거래 of the region (only when APT is requested; null otherwise). */
    trades: {
        fromYm: number;
        toYm: number;
        sale: SeoSaleSummary;
        jeonse: SeoJeonseSummary;
        recent: SeoTradeItem[];
    } | null;
    updatedAt: string;
}
/** Row of the monthly report per 법정동. */
export interface SeoReportRegionRow {
    /** Region key when the 법정동 resolves to one 지역 of the site (links to its landing). */
    regionCode: string | null;
    /** 법정동 label: "연향동" / "해룡면 신대리" (as reported when it cannot be resolved). */
    name: string;
    sale: SeoSaleSummary;
}
export interface SeoReportComplexRow {
    complexId: string | null;
    name: string;
    emdName: string | null;
    count: number;
    medianPrice: number | null;
}
/** GET /seo/reports/apartment-trades?ym */
export interface SeoTradeReportView {
    sggCode: string;
    regionName: string;
    /** Month this report covers (YYYYMM, KST 계약월). */
    yearMonth: number;
    /** Month shown without `ym`: the latest month before the current KST month that has trades. */
    latestYearMonth: number;
    /** Months with at least one 매매 trade, newest first (max 36). */
    availableMonths: number[];
    sale: SeoSaleSummary & {
        cancelledCount: number;
    };
    jeonse: SeoJeonseSummary;
    previous: {
        yearMonth: number;
        sale: SeoSaleSummary;
    } | null;
    yearAgo: {
        yearMonth: number;
        sale: SeoSaleSummary;
    } | null;
    /** Per 법정동, most trades first. */
    byRegion: SeoReportRegionRow[];
    /** 단지 with the most trades in the month (max 10). */
    topComplexes: SeoReportComplexRow[];
    /** When the month was last synced from 국토교통부 (ISO), null if unknown. */
    syncedAt: string | null;
    updatedAt: string;
}
export type SeoSitemapKind = 'complexes' | 'listings' | 'agencies';
/** GET /seo/sitemap/:kind */
export interface SeoSitemapView {
    kind: SeoSitemapKind;
    items: {
        id: string;
        lastModified: string;
    }[];
    /** True when more rows exist than were returned (cap per sitemap file). */
    truncated: boolean;
}
/** GET /seo/listings/:id/status — what to do with a listing URL that is no longer public. */
export interface SeoListingStatusView {
    id: string;
    /** PUBLIC = 광고중/계약중 (served by /listings/:id); GONE = 거래완료·비공개·삭제·만료. */
    state: 'PUBLIC' | 'GONE';
    status: ListingStatus;
    assetType: AssetType;
    complexId: string | null;
    /** Region key of the listing (8/10 digits) or null. */
    regionCode: string | null;
    /** When it stopped being public (closedAt / deletedAt / expiresAt), ISO. */
    endedAt: string | null;
}
