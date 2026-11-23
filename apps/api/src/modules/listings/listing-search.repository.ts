import {
  DealType,
  ListingAgencyStatus,
  ListingSort,
  MAP_MAX_MARKERS,
  PUBLIC_LISTING_STATUSES,
  type AssetType,
  type Bbox,
  type FloorClass,
  type ListingFilter,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { withinBbox } from '../../common/geo/geo';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Raw SQL for public search (map aggregation + sorted list). Every fragment is a Prisma.sql tagged
 * template; the only Prisma.raw() inputs are compile-time constants from this file.
 */

const PUBLIC_STATUS_SQL = Prisma.sql`l.status IN (${Prisma.join(
  PUBLIC_LISTING_STATUSES.map((s) => Prisma.sql`${s}::listing_status`),
)})`;
const PRICE_DEALS = Prisma.sql`(${DealType.SALE}::deal_type, ${DealType.PRESALE}::deal_type)`;
const DEPOSIT_DEALS = Prisma.sql`(${DealType.JEONSE}::deal_type, ${DealType.MONTHLY}::deal_type)`;

/** WHERE conditions for public search filters (status is added by the caller). */
export function filterConditions(f: ListingFilter, bbox?: Bbox): Prisma.Sql[] {
  const c: Prisma.Sql[] = [Prisma.sql`l.deleted_at IS NULL`];
  if (bbox) c.push(withinBbox(Prisma.raw('l.location'), bbox));
  if (f.assetTypes?.length) c.push(Prisma.sql`l.asset_type = ANY(${f.assetTypes}::asset_type[])`);
  if (f.dealTypes?.length) c.push(Prisma.sql`l.deal_type = ANY(${f.dealTypes}::deal_type[])`);
  if (f.priceMin !== undefined)
    c.push(Prisma.sql`(l.deal_type NOT IN ${PRICE_DEALS} OR l.price_sort >= ${f.priceMin})`);
  if (f.priceMax !== undefined)
    c.push(Prisma.sql`(l.deal_type NOT IN ${PRICE_DEALS} OR l.price_sort <= ${f.priceMax})`);
  if (f.depositMin !== undefined)
    c.push(Prisma.sql`(l.deal_type NOT IN ${DEPOSIT_DEALS} OR l.deposit >= ${f.depositMin})`);
  if (f.depositMax !== undefined)
    c.push(Prisma.sql`(l.deal_type NOT IN ${DEPOSIT_DEALS} OR l.deposit <= ${f.depositMax})`);
  if (f.rentMin !== undefined)
    c.push(
      Prisma.sql`(l.deal_type <> ${DealType.MONTHLY}::deal_type OR l.monthly_rent >= ${f.rentMin})`,
    );
  if (f.rentMax !== undefined)
    c.push(
      Prisma.sql`(l.deal_type <> ${DealType.MONTHLY}::deal_type OR l.monthly_rent <= ${f.rentMax})`,
    );
  if (f.areaMin !== undefined) c.push(Prisma.sql`l.exclusive_area >= ${f.areaMin}`);
  if (f.areaMax !== undefined) c.push(Prisma.sql`l.exclusive_area <= ${f.areaMax}`);
  if (f.roomsMin !== undefined) c.push(Prisma.sql`l.rooms >= ${f.roomsMin}`);
  if (f.bathsMin !== undefined) c.push(Prisma.sql`l.baths >= ${f.bathsMin}`);
  if (f.directions?.length) c.push(Prisma.sql`l.direction = ANY(${f.directions}::direction[])`);
  if (f.floorClasses?.length)
    c.push(Prisma.sql`l.floor_class = ANY(${f.floorClasses}::floor_class[])`);
  if (f.builtYearMin !== undefined) c.push(Prisma.sql`l.built_year >= ${f.builtYearMin}`);
  if (f.builtYearMax !== undefined) c.push(Prisma.sql`l.built_year <= ${f.builtYearMax}`);
  if (f.options?.length) c.push(Prisma.sql`l.options @> ${f.options}::listing_option[]`);
  if (f.verifiedOnly) c.push(Prisma.sql`l.verified_at IS NOT NULL`);
  if (f.complexId) c.push(Prisma.sql`l.complex_id = ${f.complexId}::uuid`);
  if (f.agencyId)
    c.push(Prisma.sql`EXISTS (SELECT 1 FROM listing_agencies la
      WHERE la.listing_id = l.id AND la.agency_id = ${f.agencyId}::uuid
        AND la.status = ${ListingAgencyStatus.ACTIVE}::listing_agency_status)`);
  if (f.emdCode) {
    const code = f.emdCode;
    if (code.length === 10) c.push(Prisma.sql`l.emd_code = ${code}`);
    else if (code.length === 5) c.push(Prisma.sql`l.sgg_code = ${code}`);
    else c.push(Prisma.sql`l.emd_code LIKE ${`${code}%`}`);
  }
  return c;
}

const and = (parts: Prisma.Sql[]): Prisma.Sql => Prisma.join(parts, ' AND ');

/** Aggregate row shared by every grouping (one row per group × deal type). */
export interface DealTypeAggRow {
  dealType: DealType;
  count: number;
  priceMin: number | null;
  priceMax: number | null;
  rentMin: number | null;
  rentMax: number | null;
}

const AGG_COLUMNS = Prisma.sql`l.deal_type::text AS "dealType", count(*)::int AS "count",
  min(l.price_sort) AS "priceMin", max(l.price_sort) AS "priceMax",
  min(l.monthly_rent) AS "rentMin", max(l.monthly_rent) AS "rentMax"`;

export interface RegionAggRow extends DealTypeAggRow {
  emd8: string | null;
  lat: number;
  lng: number;
}

export interface GridAggRow extends DealTypeAggRow {
  cx: number;
  cy: number;
  lat: number;
  lng: number;
}

export interface ComplexAggRow extends DealTypeAggRow {
  complexId: string;
  name: string;
  assetType: AssetType;
  lat: number;
  lng: number;
  households: number | null;
  builtYear: number | null;
}

export interface ListingMarkerRow {
  id: string;
  dealType: DealType;
  assetType: AssetType;
  lat: number;
  lng: number;
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  presalePrice: number | null;
  premium: number | null;
  priceSort: number | null;
  exclusiveArea: number | null;
  floorClass: FloorClass | null;
  rooms: number | null;
}

/** How each list sort maps onto an index: (status, key) with nulls handled in a second segment. */
interface SortSpec {
  key: Prisma.Sql;
  dir: 'ASC' | 'DESC';
  /** Key may be NULL on public rows: NULLs go last, ordered by recency. */
  nullable: boolean;
}

const SORTS: Record<ListingSort, SortSpec> = {
  LATEST: { key: Prisma.raw('l.published_at'), dir: 'DESC', nullable: false },
  VERIFIED: { key: Prisma.raw('l.verified_at'), dir: 'DESC', nullable: true },
  PRICE_ASC: { key: Prisma.raw('l.price_sort'), dir: 'ASC', nullable: true },
  PRICE_DESC: { key: Prisma.raw('l.price_sort'), dir: 'DESC', nullable: true },
  AREA_ASC: { key: Prisma.raw('l.exclusive_area'), dir: 'ASC', nullable: true },
  AREA_DESC: { key: Prisma.raw('l.exclusive_area'), dir: 'DESC', nullable: true },
  BUILT_YEAR_DESC: { key: Prisma.raw('l.built_year'), dir: 'DESC', nullable: true },
  PHOTO: { key: Prisma.raw('l.photo_count'), dir: 'DESC', nullable: false },
};

@Injectable()
export class ListingSearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Public (ACTIVE/RESERVED, not deleted) listings matching the filters. */
  publicWhere(f: ListingFilter, bbox?: Bbox): Prisma.Sql {
    return and([PUBLIC_STATUS_SQL, ...filterConditions(f, bbox)]);
  }

  async count(where: Prisma.Sql): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM listings l WHERE ${where}`;
    return row?.n ?? 0;
  }

  /** 읍면동 clusters: 10-digit 법정동 codes are grouped by their first 8 digits (리 → 읍·면). */
  regionAggregates(where: Prisma.Sql): Promise<RegionAggRow[]> {
    return this.prisma.$queryRaw<RegionAggRow[]>`
      SELECT substr(l.emd_code, 1, 8) AS "emd8", ${AGG_COLUMNS},
             avg(l.lat)::float8 AS "lat", avg(l.lng)::float8 AS "lng"
      FROM listings l
      WHERE ${where}
      GROUP BY 1, l.deal_type`;
  }

  /** Grid clusters: ST_SnapToGrid cells of `size` degrees. */
  gridAggregates(where: Prisma.Sql, size: number): Promise<GridAggRow[]> {
    return this.prisma.$queryRaw<GridAggRow[]>`
      SELECT ST_X(g.cell)::float8 AS "cx", ST_Y(g.cell)::float8 AS "cy",
             g.deal_type::text AS "dealType", count(*)::int AS "count",
             min(g.price_sort) AS "priceMin", max(g.price_sort) AS "priceMax",
             min(g.monthly_rent) AS "rentMin", max(g.monthly_rent) AS "rentMax",
             avg(g.lat)::float8 AS "lat", avg(g.lng)::float8 AS "lng"
      FROM (
        SELECT ST_SnapToGrid(l.location::geometry, ${size}::float8) AS cell,
               l.deal_type, l.price_sort, l.monthly_rent, l.lat, l.lng
        FROM listings l
        WHERE ${where}
      ) g
      GROUP BY 1, 2, g.deal_type`;
  }

  /** Complex markers (listings that belong to a 단지), capped. */
  complexAggregates(where: Prisma.Sql): Promise<ComplexAggRow[]> {
    return this.prisma.$queryRaw<ComplexAggRow[]>`
      SELECT c.id AS "complexId", c.name AS "name", c.asset_type::text AS "assetType",
             c.lat AS "lat", c.lng AS "lng", c.households AS "households",
             c.built_year AS "builtYear", ${AGG_COLUMNS}
      FROM listings l
      JOIN complexes c ON c.id = l.complex_id
      WHERE ${where} AND l.complex_id IS NOT NULL AND c.deleted_at IS NULL
      GROUP BY c.id, l.deal_type
      ORDER BY c.id
      LIMIT ${MAP_MAX_MARKERS * 4}`;
  }

  /** Individual markers for listings outside a 단지 (most recent first), limit+1 to detect truncation. */
  listingMarkers(where: Prisma.Sql, limit: number): Promise<ListingMarkerRow[]> {
    return this.prisma.$queryRaw<ListingMarkerRow[]>`
      SELECT l.id, l.deal_type::text AS "dealType", l.asset_type::text AS "assetType",
             l.lat, l.lng, l.sale_price AS "salePrice", l.deposit, l.monthly_rent AS "monthlyRent",
             l.presale_price AS "presalePrice", l.premium, l.price_sort AS "priceSort",
             l.exclusive_area::float8 AS "exclusiveArea", l.floor_class::text AS "floorClass",
             l.rooms
      FROM listings l
      WHERE ${where} AND l.complex_id IS NULL
      ORDER BY l.published_at DESC, l.id DESC
      LIMIT ${limit + 1}`;
  }

  /**
   * One page of public listing ids in `sort` order. Each (status × null-segment) branch is an
   * index-ordered scan of `(status, key)` limited to offset+limit rows; the outer query merges
   * them. This keeps every sort index-backed although public = two statuses.
   */
  listSql(
    f: ListingFilter,
    bbox: Bbox | undefined,
    sort: ListingSort,
    offset: number,
    limit: number,
  ): Prisma.Sql {
    const spec = SORTS[sort];
    const dir = Prisma.raw(spec.dir);
    const filters = filterConditions(f, bbox);
    const n = offset + limit;
    const segments: { cond: Prisma.Sql | null; order: Prisma.Sql; key: Prisma.Sql }[] =
      spec.nullable
        ? [
            {
              cond: Prisma.sql`${spec.key} IS NOT NULL`,
              order: Prisma.sql`${spec.key} ${dir}, l.published_at DESC, l.id DESC`,
              key: spec.key,
            },
            {
              cond: Prisma.sql`${spec.key} IS NULL`,
              order: Prisma.sql`l.published_at DESC, l.id DESC`,
              key: spec.key,
            },
          ]
        : [{ cond: null, order: Prisma.sql`${spec.key} ${dir}, l.id DESC`, key: spec.key }];
    const branches = PUBLIC_LISTING_STATUSES.flatMap((status) =>
      segments.map(
        (seg, i) => Prisma.sql`(
          SELECT l.id, ${i}::int AS seg, ${seg.key} AS k, l.published_at AS pub
          FROM listings l
          WHERE ${and([Prisma.sql`l.status = ${status}::listing_status`, ...filters, ...(seg.cond ? [seg.cond] : [])])}
          ORDER BY ${seg.order}
          LIMIT ${n})`,
      ),
    );
    const tieBreak = spec.nullable ? Prisma.sql`u.pub DESC, ` : Prisma.empty;
    return Prisma.sql`
      SELECT u.id FROM (${Prisma.join(branches, ' UNION ALL ')}) u
      ORDER BY u.seg, u.k ${dir}, ${tieBreak}u.id DESC
      OFFSET ${offset} LIMIT ${limit}`;
  }

  async listIds(
    f: ListingFilter,
    bbox: Bbox | undefined,
    sort: ListingSort,
    offset: number,
    limit: number,
  ): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(
      this.listSql(f, bbox, sort, offset, limit),
    );
    return rows.map((r) => r.id);
  }
}
