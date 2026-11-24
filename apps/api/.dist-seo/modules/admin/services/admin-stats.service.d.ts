import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AdStats, DealRequestStats, ListingStats, StatsDays, StatsSection, TrafficStats } from '../schemas';
import { VisitorStatsService } from '../visitors/visitor-stats.service';
/** "YYYY-MM-DD" KST of an instant. */
export declare function kstIsoDate(d: Date): string;
/**
 * The window of a stats request: `2 × days` KST days ending today — the first half is the
 * comparison period (`previous`), the second half the `points`.
 */
export declare function statsWindow(days: number, now: Date): {
    from: Date;
    to: Date;
    /** Start of the shown period (end of the previous one). */
    mid: Date;
    previousDates: string[];
    dates: string[];
};
/** Splits per-day rows into the shown period (zero-filled points) and the previous totals. */
export declare function splitSeries<K extends string>(win: {
    previousDates: string[];
    dates: string[];
}, byDate: Map<string, Partial<Record<K, number>>>, keys: readonly K[]): {
    points: ({
        date: string;
    } & Record<K, number>)[];
    previous: Record<K, number>;
};
/**
 * 통계 (GET /admin/stats/:section?days=7|30|90): daily series in KST, oldest → newest, last point
 * = today, plus totals of the period right before. Cached per section and window.
 */
export declare class AdminStatsService {
    private readonly prisma;
    private readonly cache;
    private readonly visitors;
    constructor(prisma: PrismaService, cache: CacheService, visitors: VisitorStatsService);
    get(section: StatsSection, days: StatsDays, now?: Date): Promise<TrafficStats | ListingStats | DealRequestStats | AdStats>;
    /** Rows `{ d: 'YYYY-MM-DD', n }` of `table.column` per KST day inside [from, to). */
    private perDay;
    traffic(days: StatsDays, now?: Date): Promise<TrafficStats>;
    listings(days: StatsDays, now?: Date): Promise<ListingStats>;
    dealRequests(days: StatsDays, now?: Date): Promise<DealRequestStats>;
    /** Top regions by request count plus "그 밖의 지역" for the rest (no region = 순천 전체). */
    private topRegions;
    ads(days: StatsDays, now?: Date): Promise<AdStats>;
}
