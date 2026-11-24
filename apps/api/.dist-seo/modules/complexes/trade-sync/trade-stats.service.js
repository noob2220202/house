"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TradeStatsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeStatsService = exports.STATS_LOCK_PREFIX = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../prisma/prisma.service");
/** Advisory-lock namespace of a 단지's stats rebuild (also taken by admin 평형 edits). */
exports.STATS_LOCK_PREFIX = 'complex-stats:';
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
let TradeStatsService = TradeStatsService_1 = class TradeStatsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** `yearMonths` undefined = every month of those complexes. Returns the number of stat rows. */
    async recompute(complexIds, yearMonths) {
        const ids = [...new Set(complexIds)].sort();
        if (ids.length === 0)
            return 0;
        return this.prisma.$transaction((tx) => this.recomputeIn(tx, ids, yearMonths), {
            timeout: 60_000,
        });
    }
    /** Same as recompute() inside the caller's transaction (locks are held until it commits). */
    async recomputeIn(tx, complexIds, yearMonths) {
        const ids = [...new Set(complexIds)].sort();
        if (ids.length === 0)
            return 0;
        await TradeStatsService_1.lock(tx, ids);
        const months = yearMonths ? [...new Set(yearMonths)] : undefined;
        const statMonth = months ? client_1.Prisma.sql `AND year_month = ANY(${months}::int[])` : client_1.Prisma.empty;
        const tradeMonth = months ? client_1.Prisma.sql `AND tr.deal_ym = ANY(${months}::int[])` : client_1.Prisma.empty;
        await tx.$executeRaw `
      DELETE FROM complex_trade_stats WHERE complex_id = ANY(${ids}::uuid[]) ${statMonth}`;
        return tx.$executeRaw `
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
    static async lock(tx, complexIds) {
        const ids = [...new Set(complexIds)].sort();
        if (ids.length === 0)
            return;
        await tx.$queryRaw `
      SELECT pg_advisory_xact_lock(hashtext(${exports.STATS_LOCK_PREFIX}::text || s.id::text))::text
      FROM (SELECT id FROM unnest(${ids}::uuid[]) AS id ORDER BY id) s`;
    }
};
exports.TradeStatsService = TradeStatsService;
exports.TradeStatsService = TradeStatsService = TradeStatsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TradeStatsService);
//# sourceMappingURL=trade-stats.service.js.map