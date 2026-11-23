import {
  applicablePrices,
  DealType,
  MAP_MAX_MARKERS,
  MapResultKind,
  type DealTypeStatsMap,
  type MapCluster,
  type MapComplexMarker,
  type MapSearchQuery,
  type MapSearchResult,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LISTINGS_SEARCH_CACHE_NS, MAP_TILE_CACHE_TTL_SECONDS } from '../constants';
import { mapTileCacheKey, planMapQuery, type MapPlan } from '../domain/map-tiles';
import {
  ListingSearchRepository,
  type ComplexAggRow,
  type DealTypeAggRow,
} from '../listing-search.repository';

interface Group {
  count: number;
  latSum: number;
  lngSum: number;
  byDealType: DealTypeStatsMap;
}

function addAgg(g: Group, row: DealTypeAggRow, lat: number, lng: number): void {
  g.count += row.count;
  g.latSum += lat * row.count;
  g.lngSum += lng * row.count;
  g.byDealType[row.dealType] = {
    count: row.count,
    priceMin: row.priceMin,
    priceMax: row.priceMax,
    ...(row.dealType === DealType.MONTHLY ? { rentMin: row.rentMin, rentMax: row.rentMax } : {}),
  };
}

const newGroup = (): Group => ({ count: 0, latSum: 0, lngSum: 0, byDealType: {} });
const round7 = (n: number): number => Math.round(n * 1e7) / 1e7;

/**
 * Map search: 읍면동 clusters (low zoom), ST_SnapToGrid clusters (mid zoom), or 단지 + 개별 매물
 * markers (high zoom). Results are computed for the tile-aligned bbox and cached briefly in Redis.
 */
@Injectable()
export class MapSearchService {
  constructor(
    private readonly repo: ListingSearchRepository,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async search(q: MapSearchQuery): Promise<MapSearchResult> {
    const { bbox, zoom, ...filter } = q;
    const plan = planMapQuery(bbox, zoom);
    const version = await this.cache.version(LISTINGS_SEARCH_CACHE_NS);
    return this.cache.getOrSet(
      mapTileCacheKey(plan, filter, version),
      MAP_TILE_CACHE_TTL_SECONDS,
      () => this.compute(plan, filter),
    );
  }

  private async compute(
    plan: MapPlan,
    filter: Omit<MapSearchQuery, 'bbox' | 'zoom'>,
  ): Promise<MapSearchResult> {
    const where = this.repo.publicWhere(filter, plan.bbox);
    const base = {
      kind: plan.kind,
      zoom: plan.zoom,
      bbox: plan.bbox,
      clusters: [],
      complexes: [],
      listings: [],
      truncated: false,
    };
    switch (plan.kind) {
      case MapResultKind.REGION_CLUSTERS: {
        const clusters = await this.regionClusters(where);
        return { ...base, clusters, total: clusters.reduce((n, c) => n + c.count, 0) };
      }
      case MapResultKind.GRID_CLUSTERS: {
        const clusters = await this.gridClusters(where, plan.gridSize);
        return { ...base, clusters, total: clusters.reduce((n, c) => n + c.count, 0) };
      }
      case MapResultKind.MARKERS: {
        const [complexRows, markers, total] = await Promise.all([
          this.repo.complexAggregates(where, MAP_MAX_MARKERS),
          this.repo.listingMarkers(where, MAP_MAX_MARKERS),
          this.repo.count(where),
        ]);
        return {
          ...base,
          complexes: complexRows.slice(0, MAP_MAX_MARKERS).map(toComplexMarker),
          listings: markers
            .slice(0, MAP_MAX_MARKERS)
            .map((m) => ({ ...m, ...applicablePrices(m.dealType, m) })),
          truncated: markers.length > MAP_MAX_MARKERS || complexRows.length > MAP_MAX_MARKERS,
          total,
        };
      }
    }
  }

  private async regionClusters(where: Prisma.Sql) {
    const rows = await this.repo.regionAggregates(where);
    const groups = new Map<string | null, Group>();
    for (const r of rows) {
      const key = r.emd8 ? `${r.emd8}00` : null;
      const g = groups.get(key) ?? newGroup();
      addAgg(g, r, r.lat, r.lng);
      groups.set(key, g);
    }
    const codes = [...groups.keys()].filter((k): k is string => k !== null);
    const regions =
      codes.length === 0
        ? []
        : await this.prisma.region.findMany({
            where: { code: { in: codes } },
            select: { code: true, name: true, lat: true, lng: true },
          });
    const regionByCode = new Map(regions.map((r) => [r.code, r]));
    return [...groups.entries()]
      .map(([code, g]): MapCluster => {
        const region = code ? regionByCode.get(code) : undefined;
        return {
          key: code ?? 'unknown',
          regionCode: code,
          name: region?.name ?? null,
          lat: round7(region?.lat ?? g.latSum / g.count),
          lng: round7(region?.lng ?? g.lngSum / g.count),
          count: g.count,
          byDealType: g.byDealType,
        };
      })
      .sort((a, b) => b.count - a.count);
  }

  private async gridClusters(where: Prisma.Sql, size: number): Promise<MapCluster[]> {
    const rows = await this.repo.gridAggregates(where, size);
    const groups = new Map<string, Group>();
    for (const r of rows) {
      const key = `${round7(r.cx)}:${round7(r.cy)}`;
      const g = groups.get(key) ?? newGroup();
      addAgg(g, r, r.lat, r.lng);
      groups.set(key, g);
    }
    return [...groups.entries()].map(([key, g]) => ({
      key,
      regionCode: null,
      name: null,
      lat: round7(g.latSum / g.count),
      lng: round7(g.lngSum / g.count),
      count: g.count,
      byDealType: g.byDealType,
    }));
  }
}

function toComplexMarker(r: ComplexAggRow): MapComplexMarker {
  const g = newGroup();
  for (const [dealType, stats] of Object.entries(r.byDealType) as [
    DealType,
    Omit<DealTypeAggRow, 'dealType'>,
  ][]) {
    addAgg(g, { dealType, ...stats }, 0, 0);
  }
  return {
    complexId: r.complexId,
    name: r.name,
    assetType: r.assetType,
    lat: r.lat,
    lng: r.lng,
    households: r.households,
    builtYear: r.builtYear,
    count: r.count,
    byDealType: g.byDealType,
  };
}
