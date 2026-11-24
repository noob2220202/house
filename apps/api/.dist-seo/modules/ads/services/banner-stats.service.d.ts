import { type BannerStatsQuery, type BannerStatsView } from '@house/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdTrackingService } from './ad-tracking.service';
/** Daily impressions/clicks/CTR of one banner: flushed DB rows merged with live Redis counts. */
export declare class BannerStatsService {
    private readonly prisma;
    private readonly tracking;
    constructor(prisma: PrismaService, tracking: AdTrackingService);
    forBanner(bannerId: string, q: BannerStatsQuery, now?: Date): Promise<BannerStatsView>;
}
