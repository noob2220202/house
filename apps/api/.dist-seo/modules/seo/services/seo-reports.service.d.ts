import { CacheService } from '../../../common/cache/cache.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import type { SeoTradeReportView } from '../seo.types';
import { SeoRegionsService } from './seo-regions.service';
/**
 * Monthly 아파트 매매 실거래 report of the service 시군구 (/reports/suncheon-apartment-trades):
 * 거래량, 평균·중위 거래가 overall and per 법정동, from the 국토교통부 rows synced into
 * trade_records. 해제(cancelled) trades are excluded from every statistic and counted separately.
 */
export declare class SeoReportsService {
    private readonly prisma;
    private readonly cache;
    private readonly config;
    private readonly regions;
    constructor(prisma: PrismaService, cache: CacheService, config: AppConfig, regions: SeoRegionsService);
    private get sggCode();
    apartmentTrades(ym: number | undefined, now?: Date): Promise<SeoTradeReportView>;
    /** Months with at least one non-cancelled 매매 trade, newest first. */
    private availableMonths;
    private compute;
}
