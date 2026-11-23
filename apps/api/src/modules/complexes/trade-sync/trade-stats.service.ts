import { Injectable } from '@nestjs/common';
import { Prisma, type TradeDealType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

interface StatAggRow {
  complexId: string;
  exclusiveArea: Prisma.Decimal;
  dealType: TradeDealType;
  yearMonth: number;
  tradeCount: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  medianMonthlyRent: number | null;
}

/**
 * Rebuilds complex_trade_stats (monthly median/min/max/avg per 단지 · 평형 · 거래유형) from
 * trade_records. Cancelled (해제) trades are excluded. Delete + insert inside one transaction, so
 * re-running is idempotent and groups that vanished (all trades 해제) disappear.
 * Trades assigned to a 평형 are grouped by the 평형's 전용면적 (84.97 vs 84.98 reports merge).
 */
@Injectable()
export class TradeStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** `yearMonths` undefined = every month of those complexes. Returns the number of stat rows. */
  async recompute(complexIds: readonly string[], yearMonths?: readonly number[]): Promise<number> {
    const ids = [...new Set(complexIds)];
    if (ids.length === 0) return 0;
    const months = yearMonths ? [...new Set(yearMonths)] : undefined;
    const monthFilter = months
      ? Prisma.sql`AND tr.deal_ym = ANY(${months}::int[])`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<StatAggRow[]>`
      SELECT tr.complex_id AS "complexId",
             COALESCE(at.exclusive_area, tr.exclusive_area) AS "exclusiveArea",
             tr.deal_type AS "dealType",
             tr.deal_ym AS "yearMonth",
             count(*)::int AS "tradeCount",
             round(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(tr.price, tr.deposit)))::int AS "medianPrice",
             min(COALESCE(tr.price, tr.deposit))::int AS "minPrice",
             max(COALESCE(tr.price, tr.deposit))::int AS "maxPrice",
             round(avg(COALESCE(tr.price, tr.deposit)))::int AS "avgPrice",
             CASE WHEN tr.deal_type = 'MONTHLY'
                  THEN round(percentile_cont(0.5) WITHIN GROUP (ORDER BY tr.monthly_rent))::int
             END AS "medianMonthlyRent"
      FROM trade_records tr
      LEFT JOIN complex_area_types at ON at.id = tr.area_type_id
      WHERE tr.complex_id = ANY(${ids}::uuid[])
        AND NOT tr.cancelled
        AND COALESCE(tr.price, tr.deposit) IS NOT NULL
        ${monthFilter}
      GROUP BY 1, 2, 3, 4`;

    await this.prisma.$transaction(async (tx) => {
      await tx.complexTradeStat.deleteMany({
        where: { complexId: { in: ids }, ...(months ? { yearMonth: { in: months } } : {}) },
      });
      if (rows.length > 0) await tx.complexTradeStat.createMany({ data: rows });
    });
    return rows.length;
  }
}
