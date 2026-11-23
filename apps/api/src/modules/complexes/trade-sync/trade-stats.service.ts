import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';

/** Advisory-lock namespace of a 단지's stats rebuild (also taken by admin 평형 edits). */
export const STATS_LOCK_PREFIX = 'complex-stats:';

/**
 * Rebuilds complex_trade_stats (monthly median/min/max/avg per 단지 · 평형 · 거래유형) from
 * trade_records. Cancelled (해제) trades are excluded. Trades assigned to a 평형 are grouped by the
 * 평형's 전용면적 (84.97 vs 84.98 reports merge).
 *
 * Concurrency: the whole rebuild (DELETE + INSERT … SELECT) runs in one transaction holding a
 * per-단지 advisory lock (taken in id order, so concurrent rebuilds of overlapping sets cannot
 * deadlock). Each statement starts after the lock is granted, so it sees every trade committed by
 * whoever rebuilt before; as every writer rebuilds after its own trade writes, the last rebuild
 * always reflects the latest data and two rebuilds never race on the unique key.
 */
@Injectable()
export class TradeStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** `yearMonths` undefined = every month of those complexes. Returns the number of stat rows. */
  async recompute(complexIds: readonly string[], yearMonths?: readonly number[]): Promise<number> {
    const ids = [...new Set(complexIds)].sort();
    if (ids.length === 0) return 0;
    return this.prisma.$transaction((tx) => this.recomputeIn(tx, ids, yearMonths), {
      timeout: 60_000,
    });
  }

  /** Same as recompute() inside the caller's transaction (locks are held until it commits). */
  async recomputeIn(
    tx: PrismaTx,
    complexIds: readonly string[],
    yearMonths?: readonly number[],
  ): Promise<number> {
    const ids = [...new Set(complexIds)].sort();
    if (ids.length === 0) return 0;
    await TradeStatsService.lock(tx, ids);
    const months = yearMonths ? [...new Set(yearMonths)] : undefined;
    const statMonth = months ? Prisma.sql`AND year_month = ANY(${months}::int[])` : Prisma.empty;
    const tradeMonth = months ? Prisma.sql`AND tr.deal_ym = ANY(${months}::int[])` : Prisma.empty;

    await tx.$executeRaw`
      DELETE FROM complex_trade_stats WHERE complex_id = ANY(${ids}::uuid[]) ${statMonth}`;
    return tx.$executeRaw`
      INSERT INTO complex_trade_stats (
        id, complex_id, exclusive_area, deal_type, year_month, trade_count,
        median_price, min_price, max_price, avg_price, median_monthly_rent, updated_at)
      SELECT gen_random_uuid(), g.*, now() FROM (
        SELECT tr.complex_id,
               COALESCE(at.exclusive_area, tr.exclusive_area),
               tr.deal_type,
               tr.deal_ym,
               count(*)::int,
               round(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(tr.price, tr.deposit)))::int,
               min(COALESCE(tr.price, tr.deposit))::int,
               max(COALESCE(tr.price, tr.deposit))::int,
               round(avg(COALESCE(tr.price, tr.deposit)))::int,
               CASE WHEN tr.deal_type = 'MONTHLY'
                    THEN round(percentile_cont(0.5) WITHIN GROUP (ORDER BY tr.monthly_rent))::int
               END
        FROM trade_records tr
        LEFT JOIN complex_area_types at ON at.id = tr.area_type_id
        WHERE tr.complex_id = ANY(${ids}::uuid[])
          AND NOT tr.cancelled
          AND COALESCE(tr.price, tr.deposit) IS NOT NULL
          ${tradeMonth}
        GROUP BY 1, 2, 3, 4
      ) g`;
  }

  /** Per-단지 transaction-scoped advisory locks, always in sorted order (no deadlocks). */
  static async lock(tx: PrismaTx, complexIds: readonly string[]): Promise<void> {
    const ids = [...new Set(complexIds)].sort();
    if (ids.length === 0) return;
    await tx.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtext(${STATS_LOCK_PREFIX}::text || s.id::text))::text
      FROM (SELECT id FROM unnest(${ids}::uuid[]) AS id ORDER BY id) s`;
  }
}
