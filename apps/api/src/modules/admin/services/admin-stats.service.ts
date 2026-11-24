import {
  AuthProvider,
  BANNER_SLOT_SPECS,
  type BannerSlot,
  DealRequestType,
  PUBLIC_LISTING_STATUSES,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { STATS_CACHE_TTL_SECONDS } from '../constants';
import type {
  AdStats,
  DealRequestStats,
  ListingStats,
  StatsDays,
  StatsSection,
  TrafficStats,
} from '../schemas';
import { VisitorStatsService } from '../visitors/visitor-stats.service';
import { regionNames } from './admin-format';
import { startOfKstDay } from './dashboard.service';

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3_600_000;
const TOP_REGIONS = 5;
const TOP_COMPLEXES = 5;
const PROVIDERS = new Set<string>(Object.values(AuthProvider));

/** "YYYY-MM-DD" KST of an instant. */
export function kstIsoDate(d: Date): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * The window of a stats request: `2 × days` KST days ending today — the first half is the
 * comparison period (`previous`), the second half the `points`.
 */
export function statsWindow(days: number, now: Date) {
  const today = startOfKstDay(now);
  const to = new Date(today.getTime() + DAY_MS);
  const from = new Date(today.getTime() - (2 * days - 1) * DAY_MS);
  const dates = Array.from({ length: 2 * days }, (_, i) =>
    kstIsoDate(new Date(from.getTime() + i * DAY_MS)),
  );
  return {
    from,
    to,
    /** Start of the shown period (end of the previous one). */
    mid: new Date(from.getTime() + days * DAY_MS),
    previousDates: dates.slice(0, days),
    dates: dates.slice(days),
  };
}

/** Splits per-day rows into the shown period (zero-filled points) and the previous totals. */
export function splitSeries<K extends string>(
  win: { previousDates: string[]; dates: string[] },
  byDate: Map<string, Partial<Record<K, number>>>,
  keys: readonly K[],
): { points: ({ date: string } & Record<K, number>)[]; previous: Record<K, number> } {
  const pick = (date: string) => {
    const row: Partial<Record<K, number>> = byDate.get(date) ?? {};
    return Object.fromEntries(keys.map((k) => [k, row[k] ?? 0])) as Record<K, number>;
  };
  const previous = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const d of win.previousDates) {
    const row = pick(d);
    for (const k of keys) previous[k] += row[k];
  }
  return { points: win.dates.map((date) => ({ date, ...pick(date) })), previous };
}

type DayCount = { d: string; n: number };

function mergeInto<K extends string>(
  target: Map<string, Partial<Record<K, number>>>,
  key: K,
  rows: DayCount[],
): void {
  for (const r of rows) target.set(r.d, { ...(target.get(r.d) ?? {}), [key]: Number(r.n) });
}

/**
 * 통계 (GET /admin/stats/:section?days=7|30|90): daily series in KST, oldest → newest, last point
 * = today, plus totals of the period right before. Cached per section and window.
 */
@Injectable()
export class AdminStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly visitors: VisitorStatsService,
  ) {}

  get(
    section: StatsSection,
    days: StatsDays,
    now = new Date(),
  ): Promise<TrafficStats | ListingStats | DealRequestStats | AdStats> {
    type AnyStats = TrafficStats | ListingStats | DealRequestStats | AdStats;
    const compute: Record<StatsSection, () => Promise<AnyStats>> = {
      traffic: () => this.traffic(days, now),
      listings: () => this.listings(days, now),
      'deal-requests': () => this.dealRequests(days, now),
      ads: () => this.ads(days, now),
    };
    return this.cache.getOrSet<AnyStats>(
      `cache:admin:stats:${section}:${days}:${kstIsoDate(now)}`,
      STATS_CACHE_TTL_SECONDS,
      compute[section],
    );
  }

  /** Rows `{ d: 'YYYY-MM-DD', n }` of `table.column` per KST day inside [from, to). */
  private perDay(
    table: string,
    column: string,
    from: Date,
    to: Date,
    extra: Prisma.Sql = Prisma.empty,
  ): Promise<DayCount[]> {
    return this.prisma.$queryRaw<DayCount[]>`
      SELECT to_char((${Prisma.raw(column)} AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD') AS d,
             count(*)::int AS n
      FROM ${Prisma.raw(table)}
      WHERE ${Prisma.raw(column)} >= ${from} AND ${Prisma.raw(column)} < ${to} ${extra}
      GROUP BY 1`;
  }

  async traffic(days: StatsDays, now = new Date()): Promise<TrafficStats> {
    const win = statsWindow(days, now);
    const [daily, signups, providers] = await Promise.all([
      this.visitors.dailyTraffic(2 * days, now),
      this.perDay('users', 'created_at', win.from, win.to),
      this.prisma.$queryRaw<{ provider: string; n: number }[]>`
        SELECT t.provider::text AS provider, count(*)::int AS n
        FROM (
          SELECT DISTINCT ON (i.user_id) i.provider
          FROM identities i JOIN users u ON u.id = i.user_id
          WHERE u.created_at >= ${win.mid} AND u.created_at < ${win.to}
          ORDER BY i.user_id, i.created_at
        ) t
        GROUP BY 1`,
    ]);
    const byDate = new Map<string, Partial<Record<'visitors' | 'pageViews' | 'signups', number>>>();
    for (const d of daily) byDate.set(d.date, { visitors: d.visitors, pageViews: d.pageViews });
    mergeInto(byDate, 'signups', signups);
    const { points, previous } = splitSeries(win, byDate, [
      'visitors',
      'pageViews',
      'signups',
    ] as const);
    const shown = new Set(win.dates);
    const devices = daily
      .filter((d) => shown.has(d.date))
      .reduce((acc, d) => ({ mobile: acc.mobile + d.mobile, desktop: acc.desktop + d.desktop }), {
        mobile: 0,
        desktop: 0,
      });
    return {
      days,
      points,
      previous,
      devices,
      signupsByProvider: providers
        .filter((p) => PROVIDERS.has(p.provider))
        .map((p) => ({ provider: p.provider as AuthProvider, count: Number(p.n) }))
        .sort((a, b) => b.count - a.count),
      // Page paths are not known to the API (it only sees API reads).
      topPages: [],
    };
  }

  async listings(days: StatsDays, now = new Date()): Promise<ListingStats> {
    const win = statsWindow(days, now);
    const live = Prisma.sql`AND deleted_at IS NULL`;
    const active: Prisma.ListingWhereInput = {
      deletedAt: null,
      status: { in: [...PUBLIC_LISTING_STATUSES] },
    };
    const [created, closed, activeTotal, byAssetType, byDealType, complexes] = await Promise.all([
      this.perDay('listings', 'published_at', win.from, win.to, live),
      this.perDay('listings', 'closed_at', win.from, win.to, live),
      this.prisma.listing.count({ where: active }),
      this.prisma.listing.groupBy({ by: ['assetType'], where: active, _count: { _all: true } }),
      this.prisma.listing.groupBy({ by: ['dealType'], where: active, _count: { _all: true } }),
      this.prisma.complex.findMany({
        where: { listings: { some: active } },
        orderBy: [{ viewCount: 'desc' }, { id: 'asc' }],
        take: TOP_COMPLEXES,
        select: {
          id: true,
          name: true,
          viewCount: true,
          _count: { select: { listings: { where: active } } },
        },
      }),
    ]);
    const byDate = new Map<string, Partial<Record<'created' | 'closed', number>>>();
    mergeInto(byDate, 'created', created);
    mergeInto(byDate, 'closed', closed);
    const { points, previous } = splitSeries(win, byDate, ['created', 'closed'] as const);
    return {
      days,
      points,
      previous,
      activeTotal,
      byAssetType: byAssetType
        .map((g) => ({ assetType: g.assetType, count: g._count._all }))
        .sort((a, b) => b.count - a.count),
      byDealType: byDealType
        .map((g) => ({ dealType: g.dealType, count: g._count._all }))
        .sort((a, b) => b.count - a.count),
      topComplexes: complexes.map((c) => ({
        id: c.id,
        name: c.name,
        views: c.viewCount,
        listings: c._count.listings,
      })),
    };
  }

  async dealRequests(days: StatsDays, now = new Date()): Promise<DealRequestStats> {
    const win = statsWindow(days, now);
    const live = Prisma.sql`AND deleted_at IS NULL`;
    const [sell, find, proposals, response, regions] = await Promise.all([
      this.perDay(
        'deal_requests',
        'created_at',
        win.from,
        win.to,
        Prisma.sql`AND deleted_at IS NULL AND type = ${DealRequestType.SELL_OR_LEASE}::deal_request_type`,
      ),
      this.perDay(
        'deal_requests',
        'created_at',
        win.from,
        win.to,
        Prisma.sql`AND deleted_at IS NULL AND type = ${DealRequestType.WANTED}::deal_request_type`,
      ),
      this.perDay('proposals', 'created_at', win.from, win.to),
      this.prisma.$queryRaw<{ total: number; answered: number; avg_minutes: number | null }[]>`
        SELECT count(*)::int AS total,
               count(f.first_at)::int AS answered,
               avg(extract(epoch FROM (f.first_at - r.created_at)) / 60)::float AS avg_minutes
        FROM deal_requests r
        LEFT JOIN LATERAL (
          SELECT min(p.created_at) AS first_at FROM proposals p WHERE p.deal_request_id = r.id
        ) f ON true
        WHERE r.created_at >= ${win.mid} AND r.created_at < ${win.to} ${live}`,
      this.prisma.$queryRaw<{ code: string | null; n: number }[]>`
        SELECT COALESCE(emd_code, region_codes[1]) AS code, count(*)::int AS n
        FROM deal_requests
        WHERE created_at >= ${win.mid} AND created_at < ${win.to} ${live}
        GROUP BY 1`,
    ]);
    const byDate = new Map<string, Partial<Record<'sell' | 'find' | 'proposals', number>>>();
    mergeInto(byDate, 'sell', sell);
    mergeInto(byDate, 'find', find);
    mergeInto(byDate, 'proposals', proposals);
    const { points, previous } = splitSeries(win, byDate, ['sell', 'find', 'proposals'] as const);
    const r = response[0];
    const total = Number(r?.total ?? 0);
    return {
      days,
      points,
      previous,
      responseRate: total > 0 ? Math.round((Number(r?.answered ?? 0) / total) * 1000) / 1000 : null,
      avgFirstResponseMinutes: r?.avg_minutes == null ? null : Math.round(Number(r.avg_minutes)),
      byRegion: await this.topRegions(regions),
    };
  }

  /** Top regions by request count plus "그 밖의 지역" for the rest (no region = 순천 전체). */
  private async topRegions(rows: { code: string | null; n: number }[]) {
    const names = await regionNames(
      this.prisma,
      rows.map((r) => r.code),
    );
    const named = new Map<string, number>();
    let rest = 0;
    for (const r of rows) {
      const name = r.code ? names.get(r.code) : undefined;
      if (name) named.set(name, (named.get(name) ?? 0) + Number(r.n));
      else rest += Number(r.n);
    }
    const sorted = [...named.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'));
    rest += sorted.slice(TOP_REGIONS).reduce((acc, r) => acc + r.count, 0);
    const top = sorted.slice(0, TOP_REGIONS);
    return rest > 0 ? [...top, { name: '그 밖의 지역', count: rest }] : top;
  }

  async ads(days: StatsDays, now = new Date()): Promise<AdStats> {
    const win = statsWindow(days, now);
    const fromDate = new Date(`${win.previousDates[0]}T00:00:00Z`);
    const midDate = new Date(`${win.dates[0]}T00:00:00Z`);
    const [daily, slots, activeBanners] = await Promise.all([
      this.prisma.$queryRaw<{ d: string; impressions: number; clicks: number }[]>`
        SELECT to_char(date, 'YYYY-MM-DD') AS d,
               sum(impressions)::int AS impressions, sum(clicks)::int AS clicks
        FROM banner_stat_daily
        WHERE date >= ${fromDate}::date
        GROUP BY 1`,
      this.prisma.$queryRaw<{ slot: BannerSlot; impressions: number; clicks: number }[]>`
        SELECT b.slot::text AS slot,
               sum(s.impressions)::int AS impressions, sum(s.clicks)::int AS clicks
        FROM banner_stat_daily s JOIN banners b ON b.id = s.banner_id
        WHERE s.date >= ${midDate}::date
        GROUP BY 1`,
      this.prisma.banner.count({
        where: { deletedAt: null, paused: false, startAt: { lte: now }, endAt: { gt: now } },
      }),
    ]);
    const byDate = new Map<string, Partial<Record<'impressions' | 'clicks', number>>>();
    for (const d of daily) {
      byDate.set(d.d, { impressions: Number(d.impressions), clicks: Number(d.clicks) });
    }
    const { points, previous } = splitSeries(win, byDate, ['impressions', 'clicks'] as const);
    return {
      days,
      points,
      previous,
      activeBanners,
      bySlot: slots
        .map((s) => ({
          slot: s.slot,
          label: BANNER_SLOT_SPECS[s.slot]?.label ?? s.slot,
          impressions: Number(s.impressions),
          clicks: Number(s.clicks),
        }))
        .sort((a, b) => b.impressions - a.impressions),
    };
  }
}
