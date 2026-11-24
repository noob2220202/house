import {
  AssetType,
  DEFAULT_REGION_NAME,
  DealType,
  ErrorCode,
  enumValues,
  yearMonthOf,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CacheService } from '../../../common/cache/cache.service';
import { AppException } from '../../../common/errors/app.exception';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RegionsService } from '../../complexes/services/regions.service';
import {
  PRIMARY_AGENCY_APPROVED_SQL,
  PUBLIC_STATUS_SQL,
} from '../../listings/listing-search.repository';
import { LANDING_COMPLEX_LIMIT, LANDING_RECENT_TRADES, SEO_CACHE_TTL_SECONDS } from '../constants';
import {
  buildRegionIndex,
  regionKeyOf,
  regionNameResolver,
  summarizeDeposits,
  summarizeSales,
  tradeWindow,
  type RegionEntry,
} from '../seo.domain';
import type {
  SeoComplexItem,
  SeoDealSummary,
  SeoRegionIndexView,
  SeoRegionLandingView,
  SeoRegionView,
  SeoTradeItem,
} from '../seo.types';

const ASSET_TYPES = enumValues(AssetType);
const DEAL_ORDER: DealType[] = [DealType.PRESALE, DealType.SALE, DealType.JEONSE, DealType.MONTHLY];
const COMPLEX_TYPES: AssetType[] = [AssetType.APT, AssetType.OFFICETEL];

/** Public listings, as everywhere else: 광고중/계약중, not deleted, approved primary office. */
const PUBLIC_LISTING_SQL = Prisma.sql`l.deleted_at IS NULL AND ${PUBLIC_STATUS_SQL} AND ${PRIMARY_AGENCY_APPROVED_SQL}`;
const regionKeySql = (col: Prisma.Sql) =>
  Prisma.sql`(CASE WHEN length(${col}) = 10 AND right(${col}, 2) = '00' THEN left(${col}, 8) ELSE ${col} END)`;
const HAS_REGION = (col: Prisma.Sql) => Prisma.sql`${col} ~ '^[0-9]{8}([0-9]{2})?$'`;

/** True when region key `key` lies in landing region `target` (an 읍·면 includes its 리). */
export function inRegion(key: string | null, target: string): boolean {
  if (!key) return false;
  return target.length === 8 ? key.startsWith(target) : key === target;
}

/** SQL prefix of the codes a landing region covers (8 digits → itself, its 00 variant and 리). */
const codePattern = (target: string): string => (target.length === 8 ? `${target}%` : target);

const emptyAssetCounts = (): Record<AssetType, number> =>
  Object.fromEntries(ASSET_TYPES.map((t) => [t, 0])) as Record<AssetType, number>;

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
const dateOnly = (d: Date): string => d.toISOString().slice(0, 10);
const later = (a: string | null, b: string | null): string | null =>
  a === null ? b : b === null ? a : a > b ? a : b;

interface TradeRow {
  dealType: 'SALE' | 'JEONSE';
  dealDate: Date;
  complexId: string | null;
  complexName: string | null;
  aptName: string;
  emdName: string | null;
  complexRegionKey: string | null;
  exclusiveArea: number;
  floor: number | null;
  price: number | null;
  deposit: number | null;
}

/**
 * 지역 data for the search landing pages (/suncheon/<지역>/<매물종류>), sitemaps and llms.txt:
 * which 읍면동/리 have listings, 단지 or 아파트 실거래, and the facts a landing page states.
 * Reads listings / 단지 / trades read-only; every number is computed from stored rows.
 */
@Injectable()
export class SeoRegionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly config: AppConfig,
    private readonly regions: RegionsService,
  ) {}

  private get sggCode(): string {
    return this.config.get('REGION_SGG_CODE');
  }

  async regionIndex(): Promise<Map<string, RegionEntry>> {
    return buildRegionIndex(await this.regions.activeSubRegions());
  }

  async regionName(): Promise<string> {
    const row = await this.prisma.region.findUnique({
      where: { code: this.sggCode },
      select: { name: true },
    });
    return row?.name ?? DEFAULT_REGION_NAME.split(' ').pop() ?? '';
  }

  index(now = new Date()): Promise<SeoRegionIndexView> {
    const window = tradeWindow(yearMonthOf(now));
    return this.cache.getOrSet(
      `cache:seo:regions:${this.sggCode}:${window.toYm}`,
      SEO_CACHE_TTL_SECONDS.REGIONS,
      () => this.computeIndex(window, now),
    );
  }

  landing(code: string, assetTypes: readonly AssetType[] | undefined, now = new Date()) {
    const key = regionKeyOf(code) ?? code;
    const types = assetTypes?.length ? [...new Set(assetTypes)].sort() : [...ASSET_TYPES];
    const window = tradeWindow(yearMonthOf(now));
    return this.cache.getOrSet(
      `cache:seo:landing:${this.sggCode}:${key}:${types.join(',')}:${window.toYm}`,
      SEO_CACHE_TTL_SECONDS.LANDING,
      () => this.computeLanding(key, types, window, now),
    );
  }

  /** Per-region views (every region of the index, with 읍·면 totals including their 리). */
  private async regionViews(window: { fromYm: number; toYm: number }): Promise<{
    index: Map<string, RegionEntry>;
    views: Map<string, SeoRegionView>;
  }> {
    const sgg = this.sggCode;
    const [index, listingRows, complexRows, tradeRows] = await Promise.all([
      this.regionIndex(),
      this.prisma.$queryRaw<
        { regionKey: string; assetType: AssetType; count: number; lastModified: Date | null }[]
      >`
        SELECT ${regionKeySql(Prisma.sql`l.emd_code`)} AS "regionKey", l.asset_type::text AS "assetType",
          count(*)::int AS "count", max(l.updated_at) AS "lastModified"
        FROM listings l
        WHERE ${PUBLIC_LISTING_SQL} AND l.sgg_code = ${sgg} AND ${HAS_REGION(Prisma.sql`l.emd_code`)}
        GROUP BY 1, 2`,
      this.prisma.$queryRaw<{ regionKey: string; count: number; lastModified: Date | null }[]>`
        SELECT ${regionKeySql(Prisma.sql`c.emd_code`)} AS "regionKey", count(*)::int AS "count",
          max(c.updated_at) AS "lastModified"
        FROM complexes c
        WHERE c.deleted_at IS NULL AND c.sgg_code = ${sgg} AND ${HAS_REGION(Prisma.sql`c.emd_code`)}
          AND c.asset_type = ANY(${COMPLEX_TYPES}::asset_type[])
        GROUP BY 1`,
      this.prisma.$queryRaw<
        {
          complexRegionKey: string | null;
          emdName: string | null;
          count: number;
          lastModified: Date | null;
        }[]
      >`
        SELECT CASE WHEN c.id IS NULL THEN NULL ELSE ${regionKeySql(Prisma.sql`c.emd_code`)} END AS "complexRegionKey",
          t.emd_name AS "emdName", count(*)::int AS "count", max(t.updated_at) AS "lastModified"
        FROM trade_records t
        LEFT JOIN complexes c ON c.id = t.complex_id AND c.deleted_at IS NULL
        WHERE t.sgg_code = ${sgg} AND t.kind = 'APT_TRADE'::trade_sync_kind
          AND t.deal_type = 'SALE'::trade_deal_type AND t.cancelled = false
          AND t.deal_ym BETWEEN ${window.fromYm} AND ${window.toYm}
        GROUP BY 1, 2`,
    ]);

    const views = new Map<string, SeoRegionView>();
    for (const r of index.values()) {
      views.set(r.code, {
        code: r.code,
        name: r.name,
        emdName: r.emdName,
        parentName: r.parentName,
        lat: r.lat,
        lng: r.lng,
        listingCounts: emptyAssetCounts(),
        complexCount: 0,
        saleTradeCount: 0,
        lastModified: null,
      });
    }
    // A 리 row counts for itself and for its 읍·면 (the 8-digit prefix).
    const targets = (key: string | null): SeoRegionView[] => {
      if (!key) return [];
      const own = views.get(key);
      const parent = key.length === 10 ? views.get(key.slice(0, 8)) : undefined;
      return [own, parent].filter((v): v is SeoRegionView => v !== undefined);
    };
    for (const row of listingRows) {
      for (const v of targets(row.regionKey)) {
        v.listingCounts[row.assetType] += row.count;
        v.lastModified = later(v.lastModified, iso(row.lastModified));
      }
    }
    for (const row of complexRows) {
      for (const v of targets(row.regionKey)) {
        v.complexCount += row.count;
        v.lastModified = later(v.lastModified, iso(row.lastModified));
      }
    }
    const resolve = regionNameResolver(index);
    for (const row of tradeRows) {
      for (const v of targets(row.complexRegionKey ?? resolve(row.emdName))) {
        v.saleTradeCount += row.count;
        v.lastModified = later(v.lastModified, iso(row.lastModified));
      }
    }
    return { index, views };
  }

  private async computeIndex(
    window: { fromYm: number; toYm: number },
    now: Date,
  ): Promise<SeoRegionIndexView> {
    const [{ index, views }, regionName] = await Promise.all([
      this.regionViews(window),
      this.regionName(),
    ]);
    const regions = [...views.values()]
      .filter(
        (v) =>
          v.complexCount > 0 ||
          v.saleTradeCount > 0 ||
          Object.values(v.listingCounts).some((n) => n > 0),
      )
      .sort((a, b) => (index.get(a.code)?.order ?? 0) - (index.get(b.code)?.order ?? 0));
    return {
      sggCode: this.sggCode,
      regionName,
      tradePeriod: window,
      regions,
      updatedAt: now.toISOString(),
    };
  }

  private async computeLanding(
    key: string,
    types: AssetType[],
    window: { fromYm: number; toYm: number },
    now: Date,
  ): Promise<SeoRegionLandingView> {
    const sgg = this.sggCode;
    const { index, views } = await this.regionViews(window);
    const region = views.get(key);
    if (!region) throw AppException.notFound(ErrorCode.REGION_NOT_FOUND);
    const pattern = codePattern(key);
    const complexTypes = types.filter((t) => COMPLEX_TYPES.includes(t));
    const wantsTrades = types.includes(AssetType.APT);

    const [dealRows, complexRows, complexTotal, tradeRows] = await Promise.all([
      this.prisma.$queryRaw<
        {
          dealType: DealType;
          count: number;
          minPrice: number | null;
          maxPrice: number | null;
          avgPrice: number | null;
          minRent: number | null;
          maxRent: number | null;
          lastPublishedAt: Date | null;
        }[]
      >`
        SELECT l.deal_type::text AS "dealType", count(*)::int AS "count",
          min(l.price_sort) FILTER (WHERE l.price_sort > 0) AS "minPrice",
          max(l.price_sort) FILTER (WHERE l.price_sort > 0) AS "maxPrice",
          round(avg(l.price_sort) FILTER (WHERE l.price_sort > 0))::int AS "avgPrice",
          min(l.monthly_rent) FILTER (WHERE l.deal_type = 'MONTHLY'::deal_type) AS "minRent",
          max(l.monthly_rent) FILTER (WHERE l.deal_type = 'MONTHLY'::deal_type) AS "maxRent",
          max(l.published_at) AS "lastPublishedAt"
        FROM listings l
        WHERE ${PUBLIC_LISTING_SQL} AND l.sgg_code = ${sgg} AND l.emd_code LIKE ${pattern}
          AND l.asset_type = ANY(${types}::asset_type[])
        GROUP BY 1`,
      complexTypes.length
        ? this.prisma.$queryRaw<
            {
              id: string;
              name: string;
              assetType: AssetType;
              households: number | null;
              builtYear: number | null;
              approvalDate: Date | null;
              activeListingCount: number;
              salePrice: number | null;
              saleDate: Date | null;
              saleArea: number | null;
              saleFloor: number | null;
            }[]
          >`
            SELECT c.id, c.name, c.asset_type::text AS "assetType", c.households,
              c.built_year AS "builtYear", c.approval_date AS "approvalDate",
              (SELECT count(*)::int FROM listings l
                WHERE l.complex_id = c.id AND ${PUBLIC_LISTING_SQL}) AS "activeListingCount",
              s.price AS "salePrice", s.deal_date AS "saleDate",
              s.exclusive_area::float AS "saleArea", s.floor AS "saleFloor"
            FROM complexes c
            LEFT JOIN LATERAL (
              SELECT t.price, t.deal_date, t.exclusive_area, t.floor FROM trade_records t
              WHERE t.complex_id = c.id AND t.deal_type = 'SALE'::trade_deal_type
                AND t.cancelled = false AND t.price > 0
              ORDER BY t.deal_date DESC, t.id DESC LIMIT 1
            ) s ON true
            WHERE c.deleted_at IS NULL AND c.sgg_code = ${sgg} AND c.emd_code LIKE ${pattern}
              AND c.asset_type = ANY(${complexTypes}::asset_type[])
            ORDER BY "activeListingCount" DESC, c.households DESC NULLS LAST, c.name ASC
            LIMIT ${LANDING_COMPLEX_LIMIT}`
        : Promise.resolve([]),
      complexTypes.length
        ? this.prisma.complex.count({
            where: {
              deletedAt: null,
              sggCode: sgg,
              assetType: { in: complexTypes },
              emdCode: key.length === 8 ? { startsWith: key } : key,
            },
          })
        : Promise.resolve(0),
      wantsTrades
        ? this.prisma.$queryRaw<TradeRow[]>`
            SELECT t.deal_type::text AS "dealType", t.deal_date AS "dealDate",
              c.id AS "complexId", c.name AS "complexName", t.apt_name AS "aptName",
              t.emd_name AS "emdName",
              CASE WHEN c.id IS NULL THEN NULL ELSE ${regionKeySql(Prisma.sql`c.emd_code`)} END AS "complexRegionKey",
              t.exclusive_area::float AS "exclusiveArea", t.floor, t.price, t.deposit
            FROM trade_records t
            LEFT JOIN complexes c ON c.id = t.complex_id AND c.deleted_at IS NULL
            WHERE t.sgg_code = ${sgg} AND t.cancelled = false
              AND t.deal_type IN ('SALE'::trade_deal_type, 'JEONSE'::trade_deal_type)
              AND t.deal_ym BETWEEN ${window.fromYm} AND ${window.toYm}
              AND (c.emd_code LIKE ${pattern} OR c.id IS NULL)`
        : Promise.resolve([]),
    ]);

    const byDealType: SeoDealSummary[] = DEAL_ORDER.flatMap((dealType) => {
      const r = dealRows.find((row) => row.dealType === dealType);
      return r
        ? [
            {
              dealType,
              count: r.count,
              minPrice: r.minPrice,
              maxPrice: r.maxPrice,
              avgPrice: r.avgPrice,
              minRent: r.minRent,
              maxRent: r.maxRent,
            },
          ]
        : [];
    });
    const lastPublishedAt = dealRows.reduce<string | null>(
      (acc, r) => later(acc, iso(r.lastPublishedAt)),
      null,
    );

    const complexes: SeoComplexItem[] = complexRows.map((c) => ({
      id: c.id,
      name: c.name,
      assetType: c.assetType,
      households: c.households,
      builtYear: c.builtYear,
      approvalDate: c.approvalDate ? dateOnly(c.approvalDate) : null,
      activeListingCount: c.activeListingCount,
      latestSale:
        c.salePrice !== null && c.saleDate !== null
          ? {
              price: c.salePrice,
              dealDate: dateOnly(c.saleDate),
              exclusiveArea: c.saleArea ?? 0,
              floor: c.saleFloor,
            }
          : null,
    }));

    let trades: SeoRegionLandingView['trades'] = null;
    if (wantsTrades) {
      const resolve = regionNameResolver(index);
      const own = tradeRows.filter((t) =>
        inRegion(t.complexRegionKey ?? resolve(t.emdName), key),
      );
      const sales = own.filter((t) => t.dealType === 'SALE' && t.price !== null && t.price > 0);
      const recent: SeoTradeItem[] = [...sales]
        .sort((a, b) => b.dealDate.getTime() - a.dealDate.getTime())
        .slice(0, LANDING_RECENT_TRADES)
        .map((t) => ({
          dealDate: dateOnly(t.dealDate),
          complexId: t.complexId,
          aptName: t.complexName ?? t.aptName,
          exclusiveArea: t.exclusiveArea,
          floor: t.floor,
          price: t.price as number,
        }));
      trades = {
        ...window,
        sale: summarizeSales(
          sales.map((t) => ({ price: t.price as number, exclusiveArea: t.exclusiveArea })),
        ),
        jeonse: summarizeDeposits(
          own.filter((t) => t.dealType === 'JEONSE').map((t) => t.deposit ?? 0),
        ),
        recent,
      };
    }

    return {
      region,
      assetTypes: types,
      listings: {
        total: byDealType.reduce((n, d) => n + d.count, 0),
        byDealType,
        lastPublishedAt,
      },
      complexes,
      complexTotal,
      trades,
      updatedAt: now.toISOString(),
    };
  }
}
