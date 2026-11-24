import type { Prisma } from '@prisma/client';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { MediaService } from '../../media/media.service';
import type { DashboardDealRequest, DashboardQueues } from '../schemas';
/** Rows previewed per dashboard panel. */
export declare const QUEUE_PREVIEW = 5;
/** 00:00 KST of the Monday of the week containing `now`. */
export declare function startOfKstWeek(now: Date): Date;
/** Average report handling time in hours (one decimal), null when nothing was handled. */
export declare function averageHandleHours(rows: {
    createdAt: Date;
    handledAt: Date | null;
}[]): number | null;
/** Click-through rate 0–1 (4 decimals), null without impressions. */
export declare function ctrOf(impressions: number, clicks: number): number | null;
declare const dealRequestSelect: {
    id: true;
    type: true;
    dealTypes: true;
    emdCode: true;
    regionCodes: true;
    complexIds: true;
    exclusiveArea: true;
    areaMin: true;
    areaMax: true;
    floor: true;
    moveInDate: true;
    desiredSalePrice: true;
    desiredDeposit: true;
    desiredMonthlyRent: true;
    priceMax: true;
    depositMax: true;
    rentMax: true;
    createdAt: true;
    complex: {
        select: {
            name: true;
        };
    };
    _count: {
        select: {
            targets: true;
            proposals: {
                where: {
                    status: {
                        in: ("SENT" | "VIEWED" | "ACCEPTED")[];
                    };
                };
            };
        };
    };
};
type DealRequestRow = Prisma.DealRequestGetPayload<{
    select: typeof dealRequestSelect;
}>;
/**
 * GET /admin/dashboard/queues — the work queues previewed on the dashboard: pending agency
 * applications (oldest first), open deal requests (newest first), open reports grouped by target
 * (newest first, with this week's handling stats) and ads ending within ADS_ENDING_SOON_DAYS.
 * Same data for every admin, so it is cached briefly like the dashboard counters.
 */
export declare class DashboardQueuesService {
    private readonly prisma;
    private readonly cache;
    private readonly media;
    constructor(prisma: PrismaService, cache: CacheService, media: MediaService);
    get(now?: Date): Promise<DashboardQueues>;
    compute(now?: Date): Promise<DashboardQueues>;
    private pendingAgencies;
    private dealRequests;
    private reports;
    private expiringAds;
}
/** One deal request as a dashboard row ("신대 레이크파크 1단지 · 34평", price, condition). */
export declare function toDashboardDealRequest(r: DealRequestRow, regions: Map<string, string>, complexNames: Map<string, string>): DashboardDealRequest;
export {};
