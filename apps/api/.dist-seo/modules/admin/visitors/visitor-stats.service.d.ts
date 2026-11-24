import type Redis from 'ioredis';
export type DeviceClass = 'mobile' | 'desktop';
/** Phones and tablets count as mobile (the web is mobile-first; tablets use the mobile layout). */
export declare function deviceClassOf(userAgent: string | null | undefined): DeviceClass;
/** A stable, non-reversible visitor id: the session when logged in, else ip + user agent. */
export declare function visitorId(input: {
    sessionToken?: string | null;
    ip?: string | null;
    userAgent?: string | null;
}): string;
/**
 * Unique daily visitors (KST days) in Redis HyperLogLogs: ~0.81% error, ≤12 KB per day, and the
 * sketch keeps no visitor ids (only register maxima), so nothing personal is stored.
 */
export declare class VisitorStatsService {
    private readonly redis;
    private readonly logger;
    constructor(redis: Redis);
    /**
     * One counted request: the visitor joins the day's HyperLogLog, and the day's request counter
     * (`pageViews` of the stats page — public API reads by visitors, a proxy for page views) and
     * device split are incremented.
     */
    record(id: string, now?: Date, device?: DeviceClass): Promise<void>;
    /** Never awaited on the request path; a Redis hiccup must not fail page loads. */
    recordSafe(id: string, now?: Date, device?: DeviceClass): void;
    /**
     * Per KST day for the last `days` days (oldest first): unique visitors, counted requests and
     * the mobile / desktop split of those requests.
     */
    dailyTraffic(days: number, now?: Date): Promise<{
        date: string;
        visitors: number;
        pageViews: number;
        mobile: number;
        desktop: number;
    }[]>;
    /** Daily unique counts for the last `days` KST days (oldest first) and their union. */
    lastDays(days: number, now?: Date): Promise<{
        daily: {
            date: string;
            count: number;
        }[];
        unique: number;
    }>;
}
