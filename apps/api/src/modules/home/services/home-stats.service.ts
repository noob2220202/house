import {
  AgencyStatus,
  AssetType,
  DEFAULT_REGION_NAME,
  DEFAULT_SGG_CODE,
  kstDayKey,
} from '@house/shared';
import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../../common/cache/cache.service';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RegionsService } from '../../complexes/services/regions.service';
import {
  ListingRegionStatsService,
  PerPyeongBasis,
  type DealCounts,
} from '../../listings/services/listing-region-stats.service';
import {
  ListingViewsService,
  type RegionViews,
} from '../../listings/services/listing-views.service';
import { kstDayStart, kstToday } from '../../listings/domain/dates';
import { HOME_CACHE_TTL_SECONDS } from '../constants';
import type { PopularRegionsQuery } from '../dto';
import { regionInfoIndex, resolveRegionInfo, type RegionInfo } from '../domain/region-info';

/** Region row of GET /home/summary (web w-home `homeRegionSchema`). */
export interface HomeRegionView {
  code: string;
  /** Display name: "연향동" / "신대리". */
  name: string;
  /** 법정동 label: "연향동" / "해룡면 신대리". */
  emdName: string | null;
  lat: number;
  lng: number;
  listingCount: number;
  /** 매매 평당가 (만원/평), null where the category is not compared that way. */
  avgPricePerPyeong: number | null;
}

/** GET /home/summary (web `homeSummarySchema`). */
export interface HomeSummaryView {
  regionName: string | null;
  listingCount: number;
  agencyCount: number;
  /** Listings with a 실매물 확인 today (KST). */
  verifiedTodayCount: number;
  assetTypeCounts: Record<AssetType, number>;
  /** 지역 with public listings, most listings first. */
  regions: HomeRegionView[];
  updatedAt: string;
}

/** Item of GET /home/popular-regions (web `popularRegionSchema`). */
export interface PopularRegionView extends HomeRegionView {
  rank: number;
  /** + moved up, − moved down, 0 flat, null = not ranked the week before. */
  rankDelta: number | null;
  dealCounts: DealCounts;
  /** Counted listing views of the region in the last 7 KST days (selected categories). */
  weeklyViewCount: number;
}

export interface PopularRegionsView {
  items: PopularRegionView[];
  updatedAt: string;
}

/**
 * Basis of the 평당가 for a category selection (web mock `perPyeongFor`): 아파트 whenever all
 * categories or 아파트 are selected, else 토지, else 상가; 원룸·주택 alone → none.
 */
export function perPyeongBasisFor(
  assetTypes: readonly AssetType[] | undefined,
): PerPyeongBasis | null {
  if (!assetTypes?.length || assetTypes.includes(AssetType.APT)) return PerPyeongBasis.APT;
  if (assetTypes.includes(AssetType.LAND)) return PerPyeongBasis.LAND;
  if (assetTypes.includes(AssetType.COMMERCIAL)) return PerPyeongBasis.COMMERCIAL;
  return null;
}

/** Views of the selected categories per region key. */
export function viewsFor(
  views: RegionViews,
  assetTypes: readonly AssetType[] | undefined,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [key, byType] of views) {
    let n = 0;
    for (const [type, count] of byType) {
      if (!assetTypes?.length || assetTypes.includes(type)) n += count;
    }
    if (n > 0) out.set(key, n);
  }
  return out;
}

/**
 * Ranks region keys by this week's views (ties: more listings, then key) and computes the rank
 * change against last week's ranking of the same candidates (null when unranked last week).
 */
export function rankRegions(
  candidates: readonly { key: string; listingCount: number }[],
  thisWeek: ReadonlyMap<string, number>,
  lastWeek: ReadonlyMap<string, number>,
): { key: string; rank: number; rankDelta: number | null; weeklyViewCount: number }[] {
  const prevRank = new Map(
    candidates
      .filter((c) => (lastWeek.get(c.key) ?? 0) > 0)
      .sort(
        (a, b) =>
          (lastWeek.get(b.key) ?? 0) - (lastWeek.get(a.key) ?? 0) ||
          b.listingCount - a.listingCount ||
          a.key.localeCompare(b.key),
      )
      .map((c, i) => [c.key, i + 1]),
  );
  return [...candidates]
    .sort(
      (a, b) =>
        (thisWeek.get(b.key) ?? 0) - (thisWeek.get(a.key) ?? 0) ||
        b.listingCount - a.listingCount ||
        a.key.localeCompare(b.key),
    )
    .map((c, i) => {
      const prev = prevRank.get(c.key);
      return {
        key: c.key,
        rank: i + 1,
        rankDelta: prev === undefined ? null : prev - (i + 1),
        weeklyViewCount: thisWeek.get(c.key) ?? 0,
      };
    });
}

/** Home hero counters and the 지역 ranking, from public listings + region view counters. */
@Injectable()
export class HomeStatsService {
  private readonly logger = new Logger(HomeStatsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: AppConfig,
    private readonly regions: RegionsService,
    private readonly stats: ListingRegionStatsService,
    private readonly views: ListingViewsService,
  ) {}

  private get sggCode(): string {
    return this.config.get('REGION_SGG_CODE');
  }

  summary(now = new Date()): Promise<HomeSummaryView> {
    return this.cache.getOrSet(
      `cache:home:summary:${this.sggCode}`,
      HOME_CACHE_TTL_SECONDS.SUMMARY,
      () => this.computeSummary(now),
    );
  }

  popularRegions(q: PopularRegionsQuery, now = new Date()): Promise<PopularRegionsView> {
    const types = [...new Set(q.assetTypes ?? [])].sort();
    return this.cache.getOrSet(
      `cache:home:popular-regions:${this.sggCode}:${kstDayKey(now)}:${types.join(',') || '-'}:${q.limit}`,
      HOME_CACHE_TTL_SECONDS.POPULAR_REGIONS,
      () => this.computePopularRegions(types, q.limit, now),
    );
  }

  /** Display name of the service 시군구 ("순천시"). */
  async regionName(): Promise<string | null> {
    const row = await this.prisma.region.findUnique({
      where: { code: this.sggCode },
      select: { name: true },
    });
    if (row) return row.name;
    return this.sggCode === DEFAULT_SGG_CODE
      ? (DEFAULT_REGION_NAME.split(' ').pop() ?? null)
      : null;
  }

  private async regionIndex(): Promise<Map<string, RegionInfo>> {
    return regionInfoIndex(await this.regions.activeSubRegions());
  }

  /**
   * Region stats that can be named (resolveRegionInfo), with their info. A region whose code
   * nothing names is left out — never shown as its raw code — and logged.
   */
  private named<T extends { regionKey: string }>(
    stats: readonly T[],
    index: ReadonlyMap<string, RegionInfo>,
  ): { stat: T; info: RegionInfo }[] {
    const unknown: string[] = [];
    const out = stats.flatMap((stat) => {
      const info = resolveRegionInfo(stat.regionKey, index);
      if (!info) unknown.push(stat.regionKey);
      return info ? [{ stat, info }] : [];
    });
    if (unknown.length > 0) {
      this.logger.warn(
        { regionKeys: unknown },
        'listings carry 법정동 codes without a regions row; left out of the home 지역 lists',
      );
    }
    return out;
  }

  private async computeSummary(now: Date): Promise<HomeSummaryView> {
    const sgg = this.sggCode;
    const [regionName, totals, agencyCount, regionStats, perPyeong, index] = await Promise.all([
      this.regionName(),
      this.stats.totals(sgg, kstDayStart(kstToday(now))),
      this.prisma.agency.count({
        where: { status: AgencyStatus.APPROVED, deletedAt: null, sggCode: sgg },
      }),
      this.stats.regionStats(sgg),
      this.stats.perPyeongByRegion(sgg, PerPyeongBasis.APT),
      this.regionIndex(),
    ]);
    const regions = this.named(regionStats, index)
      .sort(
        (a, b) =>
          b.stat.listingCount - a.stat.listingCount ||
          a.stat.regionKey.localeCompare(b.stat.regionKey),
      )
      .map(
        ({ stat: s, info }): HomeRegionView => ({
          code: s.regionKey,
          name: info.name,
          emdName: info.emdName,
          lat: info.lat ?? s.lat,
          lng: info.lng ?? s.lng,
          listingCount: s.listingCount,
          avgPricePerPyeong: perPyeong.get(s.regionKey) ?? null,
        }),
      );
    return {
      regionName,
      listingCount: totals.listingCount,
      agencyCount,
      verifiedTodayCount: totals.verifiedCount,
      assetTypeCounts: totals.assetTypeCounts,
      regions,
      updatedAt: now.toISOString(),
    };
  }

  private async computePopularRegions(
    assetTypes: AssetType[],
    limit: number,
    now: Date,
  ): Promise<PopularRegionsView> {
    const sgg = this.sggCode;
    const basis = perPyeongBasisFor(assetTypes);
    const [regionStats, perPyeong, thisWeek, lastWeek, index] = await Promise.all([
      this.stats.regionStats(sgg, assetTypes),
      basis ? this.stats.perPyeongByRegion(sgg, basis) : Promise.resolve(new Map<string, number>()),
      this.views.regionViews(0, 6, now),
      this.views.regionViews(7, 13, now),
      this.regionIndex(),
    ]);
    const named = this.named(regionStats, index);
    const byKey = new Map(named.map((n) => [n.stat.regionKey, n]));
    const ranked = rankRegions(
      named.map(({ stat: s }) => ({ key: s.regionKey, listingCount: s.listingCount })),
      viewsFor(thisWeek, assetTypes),
      viewsFor(lastWeek, assetTypes),
    ).slice(0, limit);
    const items = ranked.flatMap((r): PopularRegionView[] => {
      const n = byKey.get(r.key);
      if (!n) return [];
      const { stat: s, info } = n;
      return [
        {
          rank: r.rank,
          code: r.key,
          name: info.name,
          emdName: info.emdName,
          lat: info.lat ?? s.lat,
          lng: info.lng ?? s.lng,
          listingCount: s.listingCount,
          dealCounts: s.dealCounts,
          avgPricePerPyeong: basis ? (perPyeong.get(r.key) ?? null) : null,
          weeklyViewCount: r.weeklyViewCount,
          rankDelta: r.rankDelta,
        },
      ];
    });
    return { items, updatedAt: now.toISOString() };
  }
}
