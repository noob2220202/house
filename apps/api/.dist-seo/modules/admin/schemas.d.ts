import { type AgencyDocumentType, type AgencyStatus, type AssetType, type AuthProvider, type BannerSlot, type DealRequestType, type DealType, type ListingStatus, type ReportReason, type ReportTargetType, type UserRole, type UserStatus } from '@house/shared';
import { z } from 'zod';
/**
 * Module-local contracts of the back-office endpoints added for the admin app (WI-10):
 * dashboard queues, global search, the notification bell, statistics and social-login status.
 * They mirror the admin app's zod schemas (`apps/admin/src/features/{m-core,m-content}/api/
 * schemas.ts`) field by field. TODO(shared): promote to `packages/shared/src/schemas/admin.ts`.
 */
export declare const ADMIN_NOTIFICATION_KINDS: readonly ["AGENCY_APPLIED", "LISTING_REVIEW", "REPORT_RECEIVED", "DEAL_REQUEST_UNASSIGNED", "AD_EXPIRING", "SECURITY", "SYSTEM"];
export type AdminNotificationKind = (typeof ADMIN_NOTIFICATION_KINDS)[number];
/** GET /admin/notifications?cursor&limit&unreadOnly */
export declare const adminNotificationListQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    unreadOnly: z.ZodPreprocess<z.ZodOptional<z.ZodBoolean>, unknown>;
}, z.core.$strip>;
export type AdminNotificationListQuery = z.infer<typeof adminNotificationListQuerySchema>;
export interface AdminNotificationView {
    id: string;
    kind: AdminNotificationKind;
    title: string;
    body: string | null;
    link: string | null;
    createdAt: string;
    readAt: string | null;
}
export interface AdminNotificationPage {
    items: AdminNotificationView[];
    nextCursor: string | null;
    unreadCount: number;
}
export declare const ADMIN_SEARCH_MIN_LENGTH = 2;
export declare const ADMIN_SEARCH_DEFAULT_LIMIT = 8;
export declare const ADMIN_SEARCH_MAX_LIMIT = 20;
/** Case, spaces and hyphens do not matter (same normalisation as the admin list pages). */
export declare function normalizeSearch(q: string): string;
/** GET /admin/search?q=&limit= — `q` must have ≥ 2 characters besides spaces and hyphens. */
export declare const adminSearchQuerySchema: z.ZodObject<{
    q: z.ZodString;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type AdminSearchQuery = z.infer<typeof adminSearchQuerySchema>;
export interface AdminSearchGroup<T> {
    total: number;
    items: T[];
}
export interface AdminSearchListing {
    id: string;
    listingNo: string | null;
    title: string;
    dealType: DealType;
    price: number | null;
    deposit: number | null;
    monthlyRent: number | null;
    status: ListingStatus;
    agencyName: string | null;
    areaName: string | null;
}
export interface AdminSearchAgency {
    id: string;
    name: string;
    representativeName: string;
    registrationNumber: string | null;
    status: AgencyStatus;
    areaName: string | null;
    listingCount: number;
}
export interface AdminSearchUser {
    id: string;
    nickname: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    role: UserRole;
    status: UserStatus;
    provider: AuthProvider | null;
    joinedAt: string | null;
}
export interface AdminSearchResult {
    query: string;
    listings: AdminSearchGroup<AdminSearchListing>;
    agencies: AdminSearchGroup<AdminSearchAgency>;
    users: AdminSearchGroup<AdminSearchUser>;
}
export interface DashboardPendingAgency {
    id: string;
    name: string;
    areaName: string | null;
    representativeName: string;
    registrationNumber: string;
    status: AgencyStatus;
    appliedAt: string;
    documents: {
        submitted: number;
        required: number;
        missing: AgencyDocumentType[];
        missingLabel: string | null;
    };
    /** Registry lookups are run from the agency detail page; not known to the queue. */
    registryStatus: null;
}
export interface DashboardDealRequest {
    id: string;
    type: DealRequestType;
    title: string;
    dealType: DealType;
    price: number | null;
    deposit: number | null;
    monthlyRent: number | null;
    note: string | null;
    createdAt: string;
    deliveredAgencyCount: number;
    activeProposalCount: number;
}
export interface DashboardReport {
    id: string;
    targetType: ReportTargetType;
    targetId: string;
    reason: ReportReason;
    title: string;
    agencyName: string | null;
    reportCount: number;
    lastReportedAt: string;
}
export interface DashboardExpiringAd {
    id: string;
    kind: 'BANNER' | 'POPUP';
    advertiserName: string;
    slot: BannerSlot | null;
    placementLabel: string | null;
    endAt: string;
    ctr: number | null;
    imageUrl: string | null;
}
export interface DashboardQueues {
    pendingAgencies: AdminSearchGroup<DashboardPendingAgency>;
    dealRequests: AdminSearchGroup<DashboardDealRequest>;
    reports: AdminSearchGroup<DashboardReport> & {
        handledThisWeek: number;
        avgHandleHours: number | null;
    };
    expiringAds: AdminSearchGroup<DashboardExpiringAd>;
}
export declare const STATS_DAYS: readonly [7, 30, 90];
export type StatsDays = (typeof STATS_DAYS)[number];
/** GET /admin/stats/:section?days=7|30|90 (default 30). */
export declare const statsQuerySchema: z.ZodObject<{
    days: z.ZodDefault<z.ZodCoercedNumber<unknown> & z.ZodType<7 | 90 | 30, unknown, z.core.$ZodTypeInternals<7 | 90 | 30, unknown>>>;
}, z.core.$strip>;
export type StatsQuery = {
    days: StatsDays;
};
export declare const STATS_SECTIONS: readonly ["traffic", "listings", "deal-requests", "ads"];
export type StatsSection = (typeof STATS_SECTIONS)[number];
export declare const statsSectionParamSchema: z.ZodObject<{
    section: z.ZodEnum<{
        listings: "listings";
        ads: "ads";
        "deal-requests": "deal-requests";
        traffic: "traffic";
    }>;
}, z.core.$strip>;
export interface TrafficStats {
    days: number;
    points: {
        date: string;
        visitors: number;
        pageViews: number;
        signups: number;
    }[];
    previous: {
        visitors: number;
        pageViews: number;
        signups: number;
    };
    devices: {
        mobile: number;
        desktop: number;
    };
    signupsByProvider: {
        provider: AuthProvider;
        count: number;
    }[];
    topPages: {
        path: string;
        label: string;
        pageViews: number;
    }[];
}
export interface ListingStats {
    days: number;
    points: {
        date: string;
        created: number;
        closed: number;
    }[];
    previous: {
        created: number;
        closed: number;
    };
    activeTotal: number;
    byAssetType: {
        assetType: AssetType;
        count: number;
    }[];
    byDealType: {
        dealType: DealType;
        count: number;
    }[];
    topComplexes: {
        id: string;
        name: string;
        views: number;
        listings: number;
    }[];
}
export interface DealRequestStats {
    days: number;
    points: {
        date: string;
        sell: number;
        find: number;
        proposals: number;
    }[];
    previous: {
        sell: number;
        find: number;
        proposals: number;
    };
    responseRate: number | null;
    avgFirstResponseMinutes: number | null;
    byRegion: {
        name: string;
        count: number;
    }[];
}
export interface AdStats {
    days: number;
    points: {
        date: string;
        impressions: number;
        clicks: number;
    }[];
    previous: {
        impressions: number;
        clicks: number;
    };
    activeBanners: number;
    bySlot: {
        slot: string;
        label: string;
        impressions: number;
        clicks: number;
    }[];
}
export interface SocialLoginProviderStatus {
    provider: AuthProvider;
    enabled: boolean;
    healthy: boolean;
    clientIdMasked: string | null;
    callbackUrl: string;
    lastSuccessAt: string | null;
    last24h: {
        success: number;
        failure: number;
    };
    userShare: number | null;
    message: string | null;
}
export interface SocialLoginStatus {
    items: SocialLoginProviderStatus[];
}
