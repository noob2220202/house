import {
  addDays,
  ADS_LIMITS,
  ctrPercent,
  dateRange,
  daysBetween,
  ErrorCode,
  kstDate,
  type BannerStatPoint,
  type BannerStatsQuery,
  type BannerStatsView,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import { PrismaService } from '../../../prisma/prisma.service';
import { BANNER_STATS_DEFAULT_DAYS } from '../constants';
import { AdTrackingService } from './ad-tracking.service';

/** Daily impressions/clicks/CTR of one banner: flushed DB rows merged with live Redis counts. */
@Injectable()
export class BannerStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracking: AdTrackingService,
  ) {}

  async forBanner(
    bannerId: string,
    q: BannerStatsQuery,
    now: Date = new Date(),
  ): Promise<BannerStatsView> {
    const banner = await this.prisma.banner.findFirst({
      where: { id: bannerId, deletedAt: null },
      select: { id: true },
    });
    if (!banner) throw AppException.notFound(ErrorCode.BANNER_NOT_FOUND);

    const to = q.to ?? kstDate(now);
    const from = q.from ?? addDays(to, -(BANNER_STATS_DEFAULT_DAYS - 1));
    if (from > to || daysBetween(from, to) > ADS_LIMITS.STATS_MAX_DAYS) {
      throw AppException.badRequest(ErrorCode.BANNER_STATS_RANGE_INVALID, {
        maxDays: ADS_LIMITS.STATS_MAX_DAYS,
      });
    }

    const days = dateRange(from, to);
    const recent = new Set(this.tracking.recentDates(now));
    const [rows, live] = await Promise.all([
      this.prisma.bannerStatDaily.findMany({
        where: {
          bannerId,
          date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) },
        },
        select: { date: true, impressions: true, clicks: true },
      }),
      this.tracking.liveCounts(
        bannerId,
        days.filter((d) => recent.has(d)),
      ),
    ]);
    const stored = new Map(rows.map((r) => [r.date.toISOString().slice(0, 10), r]));

    let impressions = 0;
    let clicks = 0;
    const daily: BannerStatPoint[] = days.map((date) => {
      const db = stored.get(date);
      const rd = live.get(date);
      // Redis sets only grow during their day, so the larger value is the freshest total.
      const imp = Math.max(db?.impressions ?? 0, rd?.impressions ?? 0);
      const clk = Math.max(db?.clicks ?? 0, rd?.clicks ?? 0);
      impressions += imp;
      clicks += clk;
      return { date, impressions: imp, clicks: clk, ctr: ctrPercent(clk, imp) };
    });
    return {
      bannerId,
      from,
      to,
      totals: { impressions, clicks, ctr: ctrPercent(clicks, impressions) },
      daily,
    };
  }
}
