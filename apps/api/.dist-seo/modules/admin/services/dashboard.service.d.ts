import { type AdminDashboard } from '@house/shared';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { VisitorStatsService } from '../visitors/visitor-stats.service';
/** 00:00 KST of the day containing `now`, as a UTC instant. */
export declare function startOfKstDay(now: Date): Date;
/**
 * Back-office dashboard: counters across modules (read-only COUNTs on indexed columns) plus the
 * visitor HyperLogLogs. Cached briefly — it is polled by every open admin tab.
 */
export declare class DashboardService {
    private readonly prisma;
    private readonly cache;
    private readonly visitors;
    constructor(prisma: PrismaService, cache: CacheService, visitors: VisitorStatsService);
    get(now?: Date): Promise<AdminDashboard>;
    compute(now?: Date): Promise<AdminDashboard>;
}
