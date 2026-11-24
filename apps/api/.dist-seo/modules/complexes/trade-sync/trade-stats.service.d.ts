import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
/** Advisory-lock namespace of a 단지's stats rebuild (also taken by admin 평형 edits). */
export declare const STATS_LOCK_PREFIX = "complex-stats:";
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
export declare class TradeStatsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    /** `yearMonths` undefined = every month of those complexes. Returns the number of stat rows. */
    recompute(complexIds: readonly string[], yearMonths?: readonly number[]): Promise<number>;
    /** Same as recompute() inside the caller's transaction (locks are held until it commits). */
    recomputeIn(tx: PrismaTx, complexIds: readonly string[], yearMonths?: readonly number[]): Promise<number>;
    /** Per-단지 transaction-scoped advisory locks, always in sorted order (no deadlocks). */
    static lock(tx: PrismaTx, complexIds: readonly string[]): Promise<void>;
}
