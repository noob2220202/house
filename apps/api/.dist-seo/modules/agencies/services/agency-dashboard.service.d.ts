import { PrismaService } from '../../../prisma/prisma.service';
import { type DailyViews, type DashboardListing } from '../domain/dashboard';
/** Listing / views part of `GET /agencies/mine/dashboard` (the request feed is added by deal-requests). */
export interface AgencyListingDashboard {
    listings: {
        active: number;
        reserved: number;
        draft: number;
        /** 거래완료 in the last 30 days. */
        closed30d: number;
        /** Live (ACTIVE/RESERVED) listings this agency co-brokers for another primary agency. */
        coBrokered: number;
    };
    views: DailyViews & {
        profileViews7d: number;
        favorites7d: number;
    };
    expiringListings: DashboardListing[];
    verificationDue: DashboardListing[];
}
/**
 * Console home numbers of one agency: listing counters, 7-day listing views (daily snapshots in
 * `agency_daily_stats`), favorites, ads about to expire and listings whose 실매물 확인 is due.
 * Reads the listing tables read-only (ListingsModule exposes no such reader).
 */
export declare class AgencyDashboardService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listingDashboard(agencyId: string, now?: Date): Promise<AgencyListingDashboard>;
    /**
     * Upserts today's cumulative listing views of every APPROVED agency (or one), so the chart has a
     * baseline per day. Idempotent; the hourly job and each dashboard read call it.
     */
    snapshot(now?: Date, agencyId?: string): Promise<number>;
    private counts;
    /** Snapshots of the last 15 days (7 shown + 7 compared + 1 baseline). */
    private snapshots;
    private favorites7d;
    /** Live ads of the primary agency that lapse within a week, soonest first. */
    private expiring;
    /**
     * Live listings of the primary agency never verified, or whose last 실매물 확인 runs out within
     * a week (or already did); never verified and oldest first.
     */
    private verificationDue;
}
