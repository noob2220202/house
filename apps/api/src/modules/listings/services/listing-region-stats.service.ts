import { AssetType, DealType, SQM_PER_PYEONG, enumValues } from '@house/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PRIMARY_AGENCY_APPROVED_SQL, PUBLIC_STATUS_SQL } from '../listing-search.repository';

/** Active listings per deal type (분양권 / 매매 / 전세 / 월세). */
export interface DealCounts {
  presale: number;
  sale: number;
  jeonse: number;
  monthly: number;
}

export interface RegionListingStat {
  /** 8-digit 읍면동 or 10-digit 리 code (domain/region-key). */
  regionKey: string;
  listingCount: number;
  dealCounts: DealCounts;
  /** Mean position of the region's listings (fallback when the region has no centroid). */
  lat: number;
  lng: number;
}

/**
 * Which listings an average 평당가 (만원/평) is computed from — only where Korean listings are
 * compared that way: 아파트 (공급 평당, 전용 when 공급 is unknown), 토지 (대지 평당), 상가 (전용 평당).
 */
export const PerPyeongBasis = {
  APT: 'APT',
  LAND: 'LAND',
  COMMERCIAL: 'COMMERCIAL',
} as const;
export type PerPyeongBasis = (typeof PerPyeongBasis)[keyof typeof PerPyeongBasis];

export interface ListingTotals {
  listingCount: number;
  assetTypeCounts: Record<AssetType, number>;
  /** Listings whose latest 실매물 확인 is at or after `verifiedSince`. */
  verifiedCount: number;
}

const REGION_KEY_SQL = Prisma.sql`(CASE WHEN length(l.emd_code) = 10 AND right(l.emd_code, 2) = '00'
  THEN left(l.emd_code, 8) ELSE l.emd_code END)`;
const HAS_REGION_SQL = Prisma.sql`l.emd_code ~ '^[0-9]{8}([0-9]{2})?$'`;
const PUBLIC_SQL = Prisma.sql`l.deleted_at IS NULL AND ${PUBLIC_STATUS_SQL} AND ${PRIMARY_AGENCY_APPROVED_SQL}`;

const PER_PYEONG_SQL: Record<PerPyeongBasis, { asset: AssetType; area: Prisma.Sql }> = {
  APT: { asset: AssetType.APT, area: Prisma.sql`COALESCE(p.supply_area, l.exclusive_area)` },
  LAND: { asset: AssetType.LAND, area: Prisma.sql`p.land_area` },
  COMMERCIAL: { asset: AssetType.COMMERCIAL, area: Prisma.sql`l.exclusive_area` },
};

const DEAL_KEY: Record<DealType, keyof DealCounts> = {
  PRESALE: 'presale',
  SALE: 'sale',
  JEONSE: 'jeonse',
  MONTHLY: 'monthly',
};

export function emptyDealCounts(): DealCounts {
  return { presale: 0, sale: 0, jeonse: 0, monthly: 0 };
}

/**
 * Read-only aggregates over publicly visible listings per 지역 (home 지역 현황 / 많이 찾는 지역).
 * Same disclosure rule as public search: 광고중/계약중, not deleted, approved primary agency.
 */
@Injectable()
export class ListingRegionStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Listing counts per 지역 (and deal type) within the 시군구, optionally for some asset types. */
  async regionStats(
    sggCode: string,
    assetTypes?: readonly AssetType[],
  ): Promise<RegionListingStat[]> {
    const typeFilter = assetTypes?.length
      ? Prisma.sql`AND l.asset_type = ANY(${[...assetTypes]}::asset_type[])`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      { regionKey: string; dealType: DealType; count: number; latSum: number; lngSum: number }[]
    >`
      SELECT ${REGION_KEY_SQL} AS "regionKey", l.deal_type::text AS "dealType",
        count(*)::int AS "count", sum(l.lat)::float AS "latSum", sum(l.lng)::float AS "lngSum"
      FROM listings l
      WHERE ${PUBLIC_SQL} AND l.sgg_code = ${sggCode} AND ${HAS_REGION_SQL} ${typeFilter}
      GROUP BY 1, 2`;
    const byKey = new Map<string, RegionListingStat & { latSum: number; lngSum: number }>();
    for (const r of rows) {
      const stat = byKey.get(r.regionKey) ?? {
        regionKey: r.regionKey,
        listingCount: 0,
        dealCounts: emptyDealCounts(),
        lat: 0,
        lng: 0,
        latSum: 0,
        lngSum: 0,
      };
      stat.listingCount += r.count;
      stat.dealCounts[DEAL_KEY[r.dealType]] += r.count;
      stat.latSum += r.latSum;
      stat.lngSum += r.lngSum;
      byKey.set(r.regionKey, stat);
    }
    return [...byKey.values()].map(({ latSum, lngSum, ...s }) => ({
      ...s,
      lat: latSum / s.listingCount,
      lng: lngSum / s.listingCount,
    }));
  }

  /** Average 매매 평당가 (만원/평, rounded) per 지역 for one basis. */
  async perPyeongByRegion(sggCode: string, basis: PerPyeongBasis): Promise<Map<string, number>> {
    const { asset, area } = PER_PYEONG_SQL[basis];
    const rows = await this.prisma.$queryRaw<{ regionKey: string; perPyeong: number | null }[]>`
      SELECT ${REGION_KEY_SQL} AS "regionKey",
        avg(l.price_sort / (${area} / ${SQM_PER_PYEONG}))::float AS "perPyeong"
      FROM listings l JOIN properties p ON p.id = l.property_id
      WHERE ${PUBLIC_SQL} AND l.sgg_code = ${sggCode} AND ${HAS_REGION_SQL}
        AND l.deal_type = ${DealType.SALE}::deal_type AND l.asset_type = ${asset}::asset_type
        AND l.price_sort > 0 AND ${area} > 0
      GROUP BY 1`;
    return new Map(
      rows.flatMap((r) =>
        r.perPyeong !== null && Number.isFinite(r.perPyeong)
          ? [[r.regionKey, Math.round(r.perPyeong)] as const]
          : [],
      ),
    );
  }

  /** City-wide counters of the home hero. */
  async totals(sggCode: string, verifiedSince: Date): Promise<ListingTotals> {
    const rows = await this.prisma.$queryRaw<
      { assetType: AssetType; count: number; verified: number }[]
    >`
      SELECT l.asset_type::text AS "assetType", count(*)::int AS "count",
        (count(*) FILTER (WHERE l.verified_at >= ${verifiedSince}))::int AS "verified"
      FROM listings l
      WHERE ${PUBLIC_SQL} AND l.sgg_code = ${sggCode}
      GROUP BY 1`;
    const assetTypeCounts = Object.fromEntries(enumValues(AssetType).map((t) => [t, 0])) as Record<
      AssetType,
      number
    >;
    let listingCount = 0;
    let verifiedCount = 0;
    for (const r of rows) {
      assetTypeCounts[r.assetType] = r.count;
      listingCount += r.count;
      verifiedCount += r.verified;
    }
    return { listingCount, assetTypeCounts, verifiedCount };
  }
}
