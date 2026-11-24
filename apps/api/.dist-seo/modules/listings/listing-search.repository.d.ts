import { DealType, ListingSort, type AssetType, type Bbox, type FloorClass, type ListingFilter } from '@house/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
/**
 * Raw SQL for public search (map aggregation + sorted list). Every fragment is a Prisma.sql tagged
 * template; the only Prisma.raw() inputs are compile-time constants from this file.
 */
export declare const PUBLIC_STATUS_SQL: Prisma.Sql;
/**
 * The primary agency must be disclosable (approved, not deleted): a suspended/rejected agency's
 * ads drop out of every public query. Written as NOT IN over the (small) set of non-disclosable
 * agencies so Postgres evaluates it as a hashed filter and keeps the index-ordered list scans; an
 * EXISTS semi-join made the planner abandon the (status, key) indexes on deep pages.
 */
export declare const PRIMARY_AGENCY_APPROVED_SQL: Prisma.Sql;
/** WHERE conditions for public search filters (status is added by the caller). */
export declare function filterConditions(f: ListingFilter, bbox?: Bbox): Prisma.Sql[];
/** Aggregate row shared by every grouping (one row per group × deal type). */
export interface DealTypeAggRow {
    dealType: DealType;
    count: number;
    priceMin: number | null;
    priceMax: number | null;
    rentMin: number | null;
    rentMax: number | null;
}
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
/** One row per complex; `byDealType` is built in SQL (jsonb keyed by deal type). */
export interface ComplexAggRow {
    complexId: string;
    name: string;
    assetType: AssetType;
    lat: number;
    lng: number;
    households: number | null;
    builtYear: number | null;
    count: number;
    byDealType: Partial<Record<DealType, Omit<DealTypeAggRow, 'dealType'>>>;
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
export declare class ListingSearchRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    /** Public (ACTIVE/RESERVED, not deleted) listings matching the filters. */
    publicWhere(f: ListingFilter, bbox?: Bbox): Prisma.Sql;
    count(where: Prisma.Sql): Promise<number>;
    /** 읍면동 clusters: 10-digit 법정동 codes are grouped by their first 8 digits (리 → 읍·면). */
    regionAggregates(where: Prisma.Sql): Promise<RegionAggRow[]>;
    /**
     * Grid clusters: half-open cells [k·size, (k+1)·size) keyed by floor(coord / size), so cell
     * edges sit on multiples of `size` and therefore on tile edges (tiles are 4 cells wide, see
     * map-tiles.ts). `where` carries the GIST-backed `location && envelope` filter, which is lossy
     * (geography boxes are geocentric and loose, edges inclusive); the exact half-open lng/lat range
     * here makes every point belong to exactly one tile and one cell.
     * cx/cy are the cell centre (stable cluster key); lat/lng the listings' centroid.
     */
    gridSql(where: Prisma.Sql, size: number, tile: Bbox): Prisma.Sql;
    gridAggregates(where: Prisma.Sql, size: number, tile: Bbox): Promise<GridAggRow[]>;
    /**
     * Complex markers (listings that belong to a 단지): one row per complex with its per-deal-type
     * stats aggregated in SQL, busiest complexes first. Returns up to limit+1 rows so the caller can
     * detect truncation without cutting a complex's deal types apart.
     */
    complexAggregates(where: Prisma.Sql, limit?: number): Promise<ComplexAggRow[]>;
    /** Individual markers for listings outside a 단지 (most recent first), limit+1 to detect truncation. */
    listingMarkers(where: Prisma.Sql, limit: number): Promise<ListingMarkerRow[]>;
    /**
     * One page of public listing ids in `sort` order. Each (status × null-segment) branch is an
     * index-ordered scan of `(status, key)` limited to offset+limit rows; the outer query merges
     * them. This keeps every sort index-backed although public = two statuses.
     */
    listSql(f: ListingFilter, bbox: Bbox | undefined, sort: ListingSort, offset: number, limit: number): Prisma.Sql;
    /**
     * Disclosable co-broker count (ACTIVE links of approved, non-deleted agencies) for one page of
     * listing ids. Scoped to the ids so its cost follows the page size, not the size of
     * listing_agencies (a Prisma relation _count aggregates the whole table before joining).
     */
    agencyCountsSql(ids: string[]): Prisma.Sql;
    /**
     * Console text search (GET /agency/listings?q): ids of the agency's listings (ACTIVE membership,
     * not deleted) whose 단지명, 건물명, 도로명·지번 주소, 동, 제목 or 매물번호 contain the text, spaces
     * ignored on both sides ("레이크 파크" finds "레이크파크"). 호 is searched only on listings the
     * agency is the primary of (co-brokers never see it). `listingNo` also matches exactly.
     */
    agencyTextMatchIds(agencyId: string, text: string, listingNo: number | null): Promise<string[]>;
    agencyCounts(ids: string[]): Promise<Map<string, number>>;
    listIds(f: ListingFilter, bbox: Bbox | undefined, sort: ListingSort, offset: number, limit: number): Promise<string[]>;
}
