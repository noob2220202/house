import { type ComplexStatsQuery, type ComplexStatsView, type ComplexTradesQuery, type Paginated, type TradeView } from '@house/shared';
import { type TradeDealType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
/** 실거래가 reads for 단지 pages: trade list, monthly trends per 평형, latest per 평형. */
export declare class ComplexTradesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(complexId: string, q: ComplexTradesQuery): Promise<Paginated<TradeView>>;
    stats(complexId: string, q: ComplexStatsQuery): Promise<ComplexStatsView>;
    /** Latest non-cancelled trade per 평형 (or 전용면적 when unassigned) and deal type. */
    latestTrades(complexId: string, dealType?: TradeDealType): Promise<TradeView[]>;
    private belongsTo;
    private overall;
    private assertComplex;
}
