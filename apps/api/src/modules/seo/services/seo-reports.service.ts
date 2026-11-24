import { ErrorCode, addMonths, yearMonthOf } from '@house/shared';
import { Injectable } from '@nestjs/common';
import { CacheService } from '../../../common/cache/cache.service';
import { AppException } from '../../../common/errors/app.exception';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { REPORT_MONTHS, REPORT_TOP_COMPLEXES, SEO_CACHE_TTL_SECONDS } from '../constants';
import {
  groupByRegion,
  latestReportMonth,
  median,
  regionKeyOf,
  regionNameResolver,
  summarizeDeposits,
  summarizeSales,
  topComplexes,
  type ReportTradeRow,
} from '../seo.domain';
import type { SeoSaleSummary, SeoTradeReportView } from '../seo.types';
import { SeoRegionsService } from './seo-regions.service';

interface MonthRow {
  dealType: 'SALE' | 'JEONSE';
  dealYm: number;
  cancelled: boolean;
  price: number | null;
  deposit: number | null;
  exclusiveArea: number;
  emdName: string | null;
  aptName: string;
  complexId: string | null;
  complexName: string | null;
  complexEmdCode: string | null;
}

/**
 * Monthly 아파트 매매 실거래 report of the service 시군구 (/reports/suncheon-apartment-trades):
 * 거래량, 평균·중위 거래가 overall and per 법정동, from the 국토교통부 rows synced into
 * trade_records. 해제(cancelled) trades are excluded from every statistic and counted separately.
 */
@Injectable()
export class SeoReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: AppConfig,
    private readonly regions: SeoRegionsService,
  ) {}

  private get sggCode(): string {
    return this.config.get('REGION_SGG_CODE');
  }

  async apartmentTrades(ym: number | undefined, now = new Date()): Promise<SeoTradeReportView> {
    const currentYm = yearMonthOf(now);
    const months = await this.availableMonths();
    const latest = latestReportMonth(months, currentYm);
    const target = ym ?? latest;
    if (target === null || !months.includes(target)) {
      throw AppException.notFound(ErrorCode.NOT_FOUND);
    }
    return this.cache.getOrSet(
      `cache:seo:report:apt-trades:${this.sggCode}:${target}:${latest}:${months.length}`,
      SEO_CACHE_TTL_SECONDS.REPORT,
      () => this.compute(target, latest as number, months, now),
    );
  }

  /** Months with at least one non-cancelled 매매 trade, newest first. */
  private async availableMonths(): Promise<number[]> {
    const rows = await this.prisma.$queryRaw<{ ym: number }[]>`
      SELECT t.deal_ym AS "ym" FROM trade_records t
      WHERE t.sgg_code = ${this.sggCode} AND t.kind = 'APT_TRADE'::trade_sync_kind
        AND t.deal_type = 'SALE'::trade_deal_type AND t.cancelled = false
      GROUP BY 1 ORDER BY 1 DESC LIMIT ${REPORT_MONTHS}`;
    return rows.map((r) => r.ym);
  }

  private async compute(
    ym: number,
    latest: number,
    months: number[],
    now: Date,
  ): Promise<SeoTradeReportView> {
    const sgg = this.sggCode;
    const prev = addMonths(ym, -1);
    const yearAgo = addMonths(ym, -12);
    const [rows, index, regionName, sync] = await Promise.all([
      this.prisma.$queryRaw<MonthRow[]>`
        SELECT t.deal_type::text AS "dealType", t.deal_ym AS "dealYm", t.cancelled,
          t.price, t.deposit, t.exclusive_area::float AS "exclusiveArea", t.emd_name AS "emdName",
          t.apt_name AS "aptName", c.id AS "complexId", c.name AS "complexName",
          c.emd_code AS "complexEmdCode"
        FROM trade_records t
        LEFT JOIN complexes c ON c.id = t.complex_id AND c.deleted_at IS NULL
        WHERE t.sgg_code = ${sgg}
          AND t.deal_type IN ('SALE'::trade_deal_type, 'JEONSE'::trade_deal_type)
          AND t.deal_ym IN (${ym}, ${prev}, ${yearAgo})`,
      this.regions.regionIndex(),
      this.regions.regionName(),
      this.prisma.tradeSyncRun.findFirst({
        where: { kind: 'APT_TRADE', sggCode: sgg, yearMonth: ym, status: 'SUCCEEDED' },
        orderBy: { finishedAt: 'desc' },
        select: { finishedAt: true },
      }),
    ]);

    const salesOf = (month: number) =>
      rows.filter(
        (r) =>
          r.dealYm === month &&
          r.dealType === 'SALE' &&
          !r.cancelled &&
          r.price !== null &&
          r.price > 0,
      );
    const summaryOf = (month: number): SeoSaleSummary | null => {
      const sales = salesOf(month);
      return sales.length
        ? summarizeSales(sales.map((r) => ({ price: r.price as number, exclusiveArea: r.exclusiveArea })))
        : null;
    };

    const sales: ReportTradeRow[] = salesOf(ym).map((r) => ({
      price: r.price as number,
      exclusiveArea: r.exclusiveArea,
      emdName: r.emdName,
      complexRegionKey: regionKeyOf(r.complexEmdCode),
      complexId: r.complexId,
      complexName: r.complexName,
      aptName: r.aptName,
    }));
    const cancelledCount = rows.filter(
      (r) => r.dealYm === ym && r.dealType === 'SALE' && r.cancelled,
    ).length;
    const resolve = regionNameResolver(index);
    const prevSummary = summaryOf(prev);
    const yearAgoSummary = summaryOf(yearAgo);

    return {
      sggCode: sgg,
      regionName,
      yearMonth: ym,
      latestYearMonth: latest,
      availableMonths: months,
      sale: { ...summarizeSales(sales), cancelledCount },
      jeonse: summarizeDeposits(
        rows
          .filter((r) => r.dealYm === ym && r.dealType === 'JEONSE' && !r.cancelled)
          .map((r) => r.deposit ?? 0),
      ),
      previous: prevSummary ? { yearMonth: prev, sale: prevSummary } : null,
      yearAgo: yearAgoSummary ? { yearMonth: yearAgo, sale: yearAgoSummary } : null,
      byRegion: groupByRegion(sales, index, resolve).map((g) => ({
        regionCode: g.regionCode,
        name: g.name,
        sale: summarizeSales(g.rows),
      })),
      topComplexes: topComplexes(sales, REPORT_TOP_COMPLEXES).map((c) => ({
        complexId: c.complexId,
        name: c.name,
        emdName: c.emdName,
        count: c.prices.length,
        medianPrice: median(c.prices),
      })),
      syncedAt: sync?.finishedAt?.toISOString() ?? null,
      updatedAt: now.toISOString(),
    };
  }
}
