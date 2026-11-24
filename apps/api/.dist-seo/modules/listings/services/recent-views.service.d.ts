import { RecentViewTarget, type Paginated, type RecentViewItem, type RecentViewsQuery } from '@house/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListingSummariesService } from './listing-summaries.service';
/** 최근 본 매물/단지/중개사무소. Exported so the complexes/agencies modules can record views. */
export declare class RecentViewsService {
    private readonly prisma;
    private readonly summaries;
    private readonly logger;
    constructor(prisma: PrismaService, summaries: ListingSummariesService);
    /** Upserts the view and trims the user's history of that type to RECENT_VIEWS_CAP. Never throws. */
    record(userId: string, targetType: RecentViewTarget, targetId: string): Promise<void>;
    list(userId: string, q: RecentViewsQuery): Promise<Paginated<RecentViewItem>>;
    clear(userId: string, targetType?: RecentViewTarget): Promise<number>;
}
