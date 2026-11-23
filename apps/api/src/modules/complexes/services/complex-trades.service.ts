import { Injectable } from '@nestjs/common';
import {
  addMonths,
  ErrorCode,
  sqmToPyeong,
  type ComplexStatsQuery,
  type ComplexStatsView,
  type ComplexTradesQuery,
  type Paginated,
  type TradeStatPoint,
  type TradeStatSeries,
  type TradeView,
} from '@house/shared';
import { Prisma, type TradeDealType } from '@prisma/client';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { pyeongLabel } from '../../../common/utils/area';
import { decimalToNumber } from '../../../common/utils/decimal';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AREA_TYPE_SELECT,
  areaTypeLabel,
  TRADE_SELECT,
  toTradeView,
  type AreaTypeRow,
  type TradeRow,
} from '../complex.mapper';

interface OverallRow {
  yearMonth: number;
  tradeCount: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  medianMonthlyRent: number | null;
}

/** 실거래가 reads for 단지 pages: trade list, monthly trends per 평형, latest per 평형. */
@Injectable()
export class ComplexTradesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(complexId: string, q: ComplexTradesQuery): Promise<Paginated<TradeView>> {
    await this.assertComplex(complexId);
    const where: Prisma.TradeRecordWhereInput = {
      complexId,
      ...(q.dealType ? { dealType: q.dealType } : {}),
      ...(q.areaTypeId ? { areaTypeId: q.areaTypeId } : {}),
      ...(q.fromYm || q.toYm
        ? {
            dealYm: {
              ...(q.fromYm ? { gte: q.fromYm } : {}),
              ...(q.toYm ? { lte: q.toYm } : {}),
            },
          }
        : {}),
      ...(q.includeCancelled ? {} : { cancelled: false }),
    };
    return paginate(
      q,
      async (args) =>
        (
          await this.prisma.tradeRecord.findMany({
            where,
            orderBy: [{ dealDate: 'desc' }, { id: 'desc' }],
            select: TRADE_SELECT,
            ...args,
          })
        ).map(toTradeView),
      () => this.prisma.tradeRecord.count({ where }),
    );
  }

  async stats(complexId: string, q: ComplexStatsQuery): Promise<ComplexStatsView> {
    await this.assertComplex(complexId);
    const areaTypes = await this.prisma.complexAreaType.findMany({
      where: { complexId },
      select: AREA_TYPE_SELECT,
      orderBy: [{ exclusiveArea: 'asc' }, { typeName: 'asc' }],
    });
    const selected = q.areaTypeId ? areaTypes.find((a) => a.id === q.areaTypeId) : undefined;
    if (q.areaTypeId && !selected)
      throw AppException.notFound(ErrorCode.COMPLEX_AREA_TYPE_NOT_FOUND);

    const latestStat = await this.prisma.complexTradeStat.findFirst({
      where: { complexId, dealType: q.dealType },
      orderBy: { yearMonth: 'desc' },
      select: { yearMonth: true },
    });
    const toYm = latestStat?.yearMonth ?? null;
    const fromYm = toYm === null ? null : addMonths(toYm, -(q.months - 1));
    const latest = await this.latestTrades(complexId, q.dealType);

    if (toYm === null || fromYm === null) {
      return { complexId, dealType: q.dealType, fromYm, toYm, series: [], overall: [], latest };
    }

    const stats = await this.prisma.complexTradeStat.findMany({
      where: {
        complexId,
        dealType: q.dealType,
        yearMonth: { gte: fromYm, lte: toYm },
        ...(selected ? { exclusiveArea: selected.exclusiveArea } : {}),
      },
      orderBy: [{ exclusiveArea: 'asc' }, { yearMonth: 'asc' }],
    });
    const series = new Map<string, TradeStatSeries>();
    for (const s of stats) {
      const key = s.exclusiveArea.toFixed(2);
      let entry = series.get(key);
      if (!entry) {
        const area = s.exclusiveArea.toNumber();
        const at = areaTypes.find((a) => a.exclusiveArea.equals(s.exclusiveArea));
        entry = {
          exclusiveArea: area,
          exclusivePyeong: sqmToPyeong(area),
          areaTypeId: at?.id ?? null,
          pyeongLabel: at ? areaTypeLabel(at) : pyeongLabel(area),
          points: [],
        };
        series.set(key, entry);
      }
      entry.points.push({
        yearMonth: s.yearMonth,
        tradeCount: s.tradeCount,
        medianPrice: s.medianPrice,
        minPrice: s.minPrice,
        maxPrice: s.maxPrice,
        avgPrice: s.avgPrice,
        medianMonthlyRent: s.medianMonthlyRent,
      });
    }

    return {
      complexId,
      dealType: q.dealType,
      fromYm,
      toYm,
      series: [...series.values()],
      overall: selected ? [] : await this.overall(complexId, q.dealType, fromYm, toYm),
      latest: selected ? latest.filter((t) => this.belongsTo(t, selected)) : latest,
    };
  }

  /** Latest non-cancelled trade per 평형 (or 전용면적 when unassigned) and deal type. */
  async latestTrades(complexId: string, dealType?: TradeDealType): Promise<TradeView[]> {
    const typeFilter = dealType
      ? Prisma.sql`AND deal_type = ${dealType}::trade_deal_type`
      : Prisma.empty;
    const ids = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT ON (COALESCE(area_type_id::text, exclusive_area::text), deal_type) id
      FROM trade_records
      WHERE complex_id = ${complexId}::uuid AND NOT cancelled ${typeFilter}
      ORDER BY COALESCE(area_type_id::text, exclusive_area::text), deal_type, deal_date DESC, id DESC
      LIMIT 200`;
    if (ids.length === 0) return [];
    const rows: TradeRow[] = await this.prisma.tradeRecord.findMany({
      where: { id: { in: ids.map((r) => r.id) } },
      select: TRADE_SELECT,
      orderBy: [{ exclusiveArea: 'asc' }, { dealType: 'asc' }],
    });
    return rows.map(toTradeView);
  }

  private belongsTo(t: TradeView, at: AreaTypeRow): boolean {
    return (
      t.areaTypeId === at.id ||
      (t.areaTypeId === null && t.exclusiveArea === decimalToNumber(at.exclusiveArea))
    );
  }

  private async overall(
    complexId: string,
    dealType: TradeDealType,
    fromYm: number,
    toYm: number,
  ): Promise<TradeStatPoint[]> {
    const rows = await this.prisma.$queryRaw<OverallRow[]>`
      SELECT deal_ym AS "yearMonth",
             count(*)::int AS "tradeCount",
             round(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(price, deposit)))::int AS "medianPrice",
             min(COALESCE(price, deposit))::int AS "minPrice",
             max(COALESCE(price, deposit))::int AS "maxPrice",
             round(avg(COALESCE(price, deposit)))::int AS "avgPrice",
             CASE WHEN ${dealType}::trade_deal_type = 'MONTHLY'
                  THEN round(percentile_cont(0.5) WITHIN GROUP (ORDER BY monthly_rent))::int
             END AS "medianMonthlyRent"
      FROM trade_records
      WHERE complex_id = ${complexId}::uuid
        AND deal_type = ${dealType}::trade_deal_type
        AND deal_ym BETWEEN ${fromYm} AND ${toYm}
        AND NOT cancelled
        AND COALESCE(price, deposit) IS NOT NULL
      GROUP BY deal_ym
      ORDER BY deal_ym`;
    return rows;
  }

  private async assertComplex(id: string): Promise<void> {
    const n = await this.prisma.complex.count({ where: { id, deletedAt: null } });
    if (n === 0) throw AppException.notFound(ErrorCode.COMPLEX_NOT_FOUND);
  }
}
