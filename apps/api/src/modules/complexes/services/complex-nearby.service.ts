import {
  AgencyStatus,
  AssetType,
  DealType,
  ErrorCode,
  ListingAgencyStatus,
  PUBLIC_LISTING_STATUSES,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppException } from '../../../common/errors/app.exception';
import { geoPoint } from '../../../common/geo/geo';
import { PrismaService } from '../../../prisma/prisma.service';
import { PUBLIC_PRIMARY_AGENCY_WHERE } from '../../listings/listing.selects';
import { areaTypeLabel } from '../complex.mapper';
import { COMPLEX_MEDIA, type ComplexMediaPort } from '../ports/complex-media.port';
import { ComplexListingsService } from './complex-listings.service';

/** Item of GET /complexes/:id/nearby (web w-complex `nearbyComplexSchema`). */
export interface NearbyComplexView {
  id: string;
  name: string;
  assetType: AssetType;
  emdName: string | null;
  lat: number;
  lng: number;
  /** Straight-line distance in metres (rounded). */
  distanceM: number;
  households: number | null;
  builtYear: number | null;
  activeListingCount: number;
  dealCounts: { presale: number; sale: number; jeonse: number; monthly: number };
  /** Representative 평형 (most households) + price for the marker: "34평 4.4억". */
  representative: { pyeongLabel: string | null; price: number | null; dealType: DealType } | null;
}

/** Item of GET /complexes/:id/agencies (web w-complex `complexAgencySchema`). */
export interface ComplexAgencyView {
  agencyId: string;
  name: string;
  representativeName: string | null;
  phone: string | null;
  logoUrl: string | null;
  /** Free-text specialty line — not in the model yet. */
  specialtyLabel: string | null;
  /** The office's public listings in this 단지. */
  complexListingCount: number;
  /** Not measured yet (문의 response times are not computed; DECISIONS D16). */
  avgResponseMinutes: number | null;
}

const PUBLIC_STATUS_SQL = Prisma.sql`l.status IN (${Prisma.join(
  PUBLIC_LISTING_STATUSES.map((s) => Prisma.sql`${s}::listing_status`),
)})`;
const APPROVED_PRIMARY_SQL = Prisma.sql`l.primary_agency_id NOT IN (
  SELECT pa.id FROM agencies pa
  WHERE pa.status <> ${AgencyStatus.APPROVED}::agency_status OR pa.deleted_at IS NOT NULL)`;

/** 주변 단지 and the offices advertising in a 단지 (단지 page side panels). */
@Injectable()
export class ComplexNearbyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listings: ComplexListingsService,
    @Inject(COMPLEX_MEDIA) private readonly media: ComplexMediaPort,
  ) {}

  /** Live 단지 within `radiusM` of this one, nearest first. */
  async nearby(id: string, limit: number, radiusM: number): Promise<NearbyComplexView[]> {
    const origin = await this.prisma.complex.findFirst({
      where: { id, deletedAt: null },
      select: { lat: true, lng: true },
    });
    if (!origin) throw AppException.notFound(ErrorCode.COMPLEX_NOT_FOUND);
    const point = geoPoint(origin.lat, origin.lng);
    const hits = await this.prisma.$queryRaw<{ id: string; distanceM: number }[]>`
      SELECT c.id, ST_Distance(c.location, ${point})::float AS "distanceM"
      FROM complexes c
      WHERE c.deleted_at IS NULL AND c.id <> ${id}::uuid AND c.location IS NOT NULL
        AND ST_DWithin(c.location, ${point}, ${radiusM})
      ORDER BY "distanceM" ASC, c.id ASC
      LIMIT ${limit}`;
    if (hits.length === 0) return [];
    const ids = hits.map((h) => h.id);

    const [rows, counts] = await Promise.all([
      this.prisma.complex.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          assetType: true,
          emdName: true,
          lat: true,
          lng: true,
          households: true,
          builtYear: true,
          areaTypes: {
            orderBy: [{ households: { sort: 'desc', nulls: 'last' } }, { exclusiveArea: 'asc' }],
            take: 1,
            select: { id: true, exclusiveArea: true, supplyArea: true, pyeongLabel: true },
          },
        },
      }),
      this.listings.countsFor(ids),
    ]);
    const mainAreaIds = rows.flatMap((r) => (r.areaTypes[0] ? [r.areaTypes[0].id] : []));
    const [listingPrices, tradePrices] = await Promise.all([
      this.minListingPrices(ids),
      this.latestSalePrices(mainAreaIds),
    ]);

    const byId = new Map(rows.map((r) => [r.id, r]));
    return hits.flatMap((h) => {
      const r = byId.get(h.id);
      if (!r) return [];
      const c = counts.get(r.id);
      const byType = c?.byDealType ?? { SALE: 0, JEONSE: 0, MONTHLY: 0, PRESALE: 0 };
      const main = r.areaTypes[0];
      const dealType = byType.PRESALE > byType.SALE ? DealType.PRESALE : DealType.SALE;
      const price = main
        ? (listingPrices.get(`${r.id}|${dealType}|${main.id}`) ??
          (dealType === DealType.SALE ? tradePrices.get(main.id) : undefined) ??
          null)
        : null;
      return [
        {
          id: r.id,
          name: r.name,
          assetType: r.assetType,
          emdName: r.emdName,
          lat: r.lat,
          lng: r.lng,
          distanceM: Math.round(h.distanceM),
          households: r.households,
          builtYear: r.builtYear,
          activeListingCount: c?.total ?? 0,
          dealCounts: {
            presale: byType.PRESALE,
            sale: byType.SALE,
            jeonse: byType.JEONSE,
            monthly: byType.MONTHLY,
          },
          representative: main ? { pyeongLabel: areaTypeLabel(main), price, dealType } : null,
        },
      ];
    });
  }

  /** Approved offices with public listings in the 단지, most listings first. */
  async agencies(id: string, limit: number): Promise<ComplexAgencyView[]> {
    const exists = await this.prisma.complex.count({ where: { id, deletedAt: null } });
    if (exists === 0) throw AppException.notFound(ErrorCode.COMPLEX_NOT_FOUND);
    const groups = await this.prisma.listingAgency.groupBy({
      by: ['agencyId'],
      where: {
        status: ListingAgencyStatus.ACTIVE,
        agency: { status: AgencyStatus.APPROVED, deletedAt: null },
        listing: {
          complexId: id,
          deletedAt: null,
          status: { in: [...PUBLIC_LISTING_STATUSES] },
          ...PUBLIC_PRIMARY_AGENCY_WHERE,
        },
      },
      _count: { _all: true },
    });
    if (groups.length === 0) return [];
    const agencies = await this.prisma.agency.findMany({
      where: { id: { in: groups.map((g) => g.agencyId) } },
      select: {
        id: true,
        name: true,
        representativeName: true,
        phone: true,
        logo: { select: { storageKey: true, variants: true, deletedAt: true } },
      },
    });
    const count = new Map(groups.map((g) => [g.agencyId, g._count._all]));
    return agencies
      .map(
        (a): ComplexAgencyView => ({
          agencyId: a.id,
          name: a.name,
          representativeName: a.representativeName,
          phone: a.phone,
          logoUrl: a.logo && !a.logo.deletedAt ? this.media.urls(a.logo).thumbUrl : null,
          specialtyLabel: null,
          complexListingCount: count.get(a.id) ?? 0,
          avgResponseMinutes: null,
        }),
      )
      .sort(
        (x, y) =>
          y.complexListingCount - x.complexListingCount ||
          x.name.localeCompare(y.name, 'ko') ||
          x.agencyId.localeCompare(y.agencyId),
      )
      .slice(0, limit);
  }

  /** Lowest public asking price per (단지, deal type, 평형) — key `complexId|dealType|areaTypeId`. */
  private async minListingPrices(complexIds: string[]): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<
      { complexId: string; dealType: DealType; areaTypeId: string; price: number }[]
    >`
      SELECT l.complex_id AS "complexId", l.deal_type::text AS "dealType",
        p.area_type_id AS "areaTypeId", min(l.price_sort)::int AS "price"
      FROM listings l JOIN properties p ON p.id = l.property_id
      WHERE l.complex_id = ANY(${complexIds}::uuid[]) AND l.deleted_at IS NULL
        AND ${PUBLIC_STATUS_SQL} AND ${APPROVED_PRIMARY_SQL}
        AND p.area_type_id IS NOT NULL AND l.price_sort IS NOT NULL
      GROUP BY 1, 2, 3`;
    return new Map(rows.map((r) => [`${r.complexId}|${r.dealType}|${r.areaTypeId}`, r.price]));
  }

  /** Latest (not cancelled) 매매 실거래가 per 평형. */
  private async latestSalePrices(areaTypeIds: string[]): Promise<Map<string, number>> {
    if (areaTypeIds.length === 0) return new Map();
    const rows = await this.prisma.$queryRaw<{ areaTypeId: string; price: number }[]>`
      SELECT DISTINCT ON (area_type_id) area_type_id AS "areaTypeId", price
      FROM trade_records
      WHERE area_type_id = ANY(${areaTypeIds}::uuid[]) AND deal_type = 'SALE'::trade_deal_type
        AND NOT cancelled AND price IS NOT NULL
      ORDER BY area_type_id, deal_date DESC, id DESC`;
    return new Map(rows.map((r) => [r.areaTypeId, r.price]));
  }
}
