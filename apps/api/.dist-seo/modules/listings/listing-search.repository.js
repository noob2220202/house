"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingSearchRepository = exports.PRIMARY_AGENCY_APPROVED_SQL = exports.PUBLIC_STATUS_SQL = void 0;
exports.filterConditions = filterConditions;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const geo_1 = require("../../common/geo/geo");
const prisma_service_1 = require("../../prisma/prisma.service");
/**
 * Raw SQL for public search (map aggregation + sorted list). Every fragment is a Prisma.sql tagged
 * template; the only Prisma.raw() inputs are compile-time constants from this file.
 */
exports.PUBLIC_STATUS_SQL = client_1.Prisma.sql `l.status IN (${client_1.Prisma.join(shared_1.PUBLIC_LISTING_STATUSES.map((s) => client_1.Prisma.sql `${s}::listing_status`))})`;
const PRICE_DEALS = client_1.Prisma.sql `(${shared_1.DealType.SALE}::deal_type, ${shared_1.DealType.PRESALE}::deal_type)`;
const DEPOSIT_DEALS = client_1.Prisma.sql `(${shared_1.DealType.JEONSE}::deal_type, ${shared_1.DealType.MONTHLY}::deal_type)`;
/**
 * The primary agency must be disclosable (approved, not deleted): a suspended/rejected agency's
 * ads drop out of every public query. Written as NOT IN over the (small) set of non-disclosable
 * agencies so Postgres evaluates it as a hashed filter and keeps the index-ordered list scans; an
 * EXISTS semi-join made the planner abandon the (status, key) indexes on deep pages.
 */
exports.PRIMARY_AGENCY_APPROVED_SQL = client_1.Prisma.sql `l.primary_agency_id NOT IN (
  SELECT pa.id FROM agencies pa
  WHERE pa.status <> ${shared_1.AgencyStatus.APPROVED}::agency_status OR pa.deleted_at IS NOT NULL)`;
/** WHERE conditions for public search filters (status is added by the caller). */
function filterConditions(f, bbox) {
    const c = [client_1.Prisma.sql `l.deleted_at IS NULL`, exports.PRIMARY_AGENCY_APPROVED_SQL];
    if (bbox)
        c.push((0, geo_1.withinBbox)(client_1.Prisma.raw('l.location'), bbox));
    if (f.assetTypes?.length)
        c.push(client_1.Prisma.sql `l.asset_type = ANY(${f.assetTypes}::asset_type[])`);
    if (f.dealTypes?.length)
        c.push(client_1.Prisma.sql `l.deal_type = ANY(${f.dealTypes}::deal_type[])`);
    if (f.priceMin !== undefined)
        c.push(client_1.Prisma.sql `(l.deal_type NOT IN ${PRICE_DEALS} OR l.price_sort >= ${f.priceMin})`);
    if (f.priceMax !== undefined)
        c.push(client_1.Prisma.sql `(l.deal_type NOT IN ${PRICE_DEALS} OR l.price_sort <= ${f.priceMax})`);
    if (f.depositMin !== undefined)
        c.push(client_1.Prisma.sql `(l.deal_type NOT IN ${DEPOSIT_DEALS} OR l.deposit >= ${f.depositMin})`);
    if (f.depositMax !== undefined)
        c.push(client_1.Prisma.sql `(l.deal_type NOT IN ${DEPOSIT_DEALS} OR l.deposit <= ${f.depositMax})`);
    if (f.rentMin !== undefined)
        c.push(client_1.Prisma.sql `(l.deal_type <> ${shared_1.DealType.MONTHLY}::deal_type OR l.monthly_rent >= ${f.rentMin})`);
    if (f.rentMax !== undefined)
        c.push(client_1.Prisma.sql `(l.deal_type <> ${shared_1.DealType.MONTHLY}::deal_type OR l.monthly_rent <= ${f.rentMax})`);
    if (f.areaMin !== undefined)
        c.push(client_1.Prisma.sql `l.exclusive_area >= ${f.areaMin}`);
    if (f.areaMax !== undefined)
        c.push(client_1.Prisma.sql `l.exclusive_area <= ${f.areaMax}`);
    if (f.roomsMin !== undefined)
        c.push(client_1.Prisma.sql `l.rooms >= ${f.roomsMin}`);
    if (f.bathsMin !== undefined)
        c.push(client_1.Prisma.sql `l.baths >= ${f.bathsMin}`);
    if (f.directions?.length)
        c.push(client_1.Prisma.sql `l.direction = ANY(${f.directions}::direction[])`);
    if (f.floorClasses?.length)
        c.push(client_1.Prisma.sql `l.floor_class = ANY(${f.floorClasses}::floor_class[])`);
    if (f.builtYearMin !== undefined)
        c.push(client_1.Prisma.sql `l.built_year >= ${f.builtYearMin}`);
    if (f.builtYearMax !== undefined)
        c.push(client_1.Prisma.sql `l.built_year <= ${f.builtYearMax}`);
    if (f.options?.length)
        c.push(client_1.Prisma.sql `l.options @> ${f.options}::listing_option[]`);
    if (f.verifiedOnly)
        c.push(client_1.Prisma.sql `l.verified_at IS NOT NULL`);
    if (f.roomTypes?.length)
        c.push(client_1.Prisma.sql `l.room_type = ANY(${f.roomTypes}::room_type[])`);
    if (f.landZones?.length)
        c.push(client_1.Prisma.sql `l.land_zone = ANY(${f.landZones}::land_zone[])`);
    if (f.landCategories?.length)
        c.push(client_1.Prisma.sql `l.land_category = ANY(${f.landCategories}::land_category[])`);
    if (f.complexId)
        c.push(client_1.Prisma.sql `l.complex_id = ${f.complexId}::uuid`);
    if (f.agencyId)
        c.push(client_1.Prisma.sql `EXISTS (SELECT 1 FROM listing_agencies la
      WHERE la.listing_id = l.id AND la.agency_id = ${f.agencyId}::uuid
        AND la.status = ${shared_1.ListingAgencyStatus.ACTIVE}::listing_agency_status)`);
    if (f.emdCode) {
        const code = f.emdCode;
        if (code.length === 10)
            c.push(client_1.Prisma.sql `l.emd_code = ${code}`);
        else if (code.length === 5)
            c.push(client_1.Prisma.sql `l.sgg_code = ${code}`);
        else
            c.push(client_1.Prisma.sql `l.emd_code LIKE ${`${code}%`}`);
    }
    return c;
}
const and = (parts) => client_1.Prisma.join(parts, ' AND ');
const AGG_COLUMNS = client_1.Prisma.sql `l.deal_type::text AS "dealType", count(*)::int AS "count",
  min(l.price_sort) AS "priceMin", max(l.price_sort) AS "priceMax",
  min(l.monthly_rent) AS "rentMin", max(l.monthly_rent) AS "rentMax"`;
const SORTS = {
    LATEST: { key: client_1.Prisma.raw('l.published_at'), dir: 'DESC', nullable: false },
    VERIFIED: { key: client_1.Prisma.raw('l.verified_at'), dir: 'DESC', nullable: true },
    PRICE_ASC: { key: client_1.Prisma.raw('l.price_sort'), dir: 'ASC', nullable: true },
    PRICE_DESC: { key: client_1.Prisma.raw('l.price_sort'), dir: 'DESC', nullable: true },
    AREA_ASC: { key: client_1.Prisma.raw('l.exclusive_area'), dir: 'ASC', nullable: true },
    AREA_DESC: { key: client_1.Prisma.raw('l.exclusive_area'), dir: 'DESC', nullable: true },
    BUILT_YEAR_DESC: { key: client_1.Prisma.raw('l.built_year'), dir: 'DESC', nullable: true },
    PHOTO: { key: client_1.Prisma.raw('l.photo_count'), dir: 'DESC', nullable: false },
};
let ListingSearchRepository = class ListingSearchRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** Public (ACTIVE/RESERVED, not deleted) listings matching the filters. */
    publicWhere(f, bbox) {
        return and([exports.PUBLIC_STATUS_SQL, ...filterConditions(f, bbox)]);
    }
    async count(where) {
        const [row] = await this.prisma.$queryRaw `
      SELECT count(*)::int AS n FROM listings l WHERE ${where}`;
        return row?.n ?? 0;
    }
    /** 읍면동 clusters: 10-digit 법정동 codes are grouped by their first 8 digits (리 → 읍·면). */
    regionAggregates(where) {
        return this.prisma.$queryRaw `
      SELECT substr(l.emd_code, 1, 8) AS "emd8", ${AGG_COLUMNS},
             avg(l.lat)::float8 AS "lat", avg(l.lng)::float8 AS "lng"
      FROM listings l
      WHERE ${where}
      GROUP BY 1, l.deal_type`;
    }
    /**
     * Grid clusters: half-open cells [k·size, (k+1)·size) keyed by floor(coord / size), so cell
     * edges sit on multiples of `size` and therefore on tile edges (tiles are 4 cells wide, see
     * map-tiles.ts). `where` carries the GIST-backed `location && envelope` filter, which is lossy
     * (geography boxes are geocentric and loose, edges inclusive); the exact half-open lng/lat range
     * here makes every point belong to exactly one tile and one cell.
     * cx/cy are the cell centre (stable cluster key); lat/lng the listings' centroid.
     */
    gridSql(where, size, tile) {
        return client_1.Prisma.sql `
      SELECT ((g.ix + 0.5) * ${size}::float8)::float8 AS "cx",
             ((g.iy + 0.5) * ${size}::float8)::float8 AS "cy",
             g.deal_type::text AS "dealType", count(*)::int AS "count",
             min(g.price_sort) AS "priceMin", max(g.price_sort) AS "priceMax",
             min(g.monthly_rent) AS "rentMin", max(g.monthly_rent) AS "rentMax",
             avg(g.lat)::float8 AS "lat", avg(g.lng)::float8 AS "lng"
      FROM (
        SELECT floor(l.lng / ${size}::float8) AS ix, floor(l.lat / ${size}::float8) AS iy,
               l.deal_type, l.price_sort, l.monthly_rent, l.lat, l.lng
        FROM listings l
        WHERE ${where}
          AND l.lng >= ${tile.swLng}::float8 AND l.lng < ${tile.neLng}::float8
          AND l.lat >= ${tile.swLat}::float8 AND l.lat < ${tile.neLat}::float8
      ) g
      GROUP BY g.ix, g.iy, g.deal_type`;
    }
    gridAggregates(where, size, tile) {
        return this.prisma.$queryRaw(this.gridSql(where, size, tile));
    }
    /**
     * Complex markers (listings that belong to a 단지): one row per complex with its per-deal-type
     * stats aggregated in SQL, busiest complexes first. Returns up to limit+1 rows so the caller can
     * detect truncation without cutting a complex's deal types apart.
     */
    complexAggregates(where, limit = shared_1.MAP_MAX_MARKERS) {
        return this.prisma.$queryRaw `
      SELECT c.id AS "complexId", c.name AS "name", c.asset_type::text AS "assetType",
             c.lat AS "lat", c.lng AS "lng", c.households AS "households",
             c.built_year AS "builtYear", sum(g.count)::int AS "count",
             jsonb_object_agg(g.deal_type, jsonb_build_object(
               'count', g.count, 'priceMin', g.price_min, 'priceMax', g.price_max,
               'rentMin', g.rent_min, 'rentMax', g.rent_max)) AS "byDealType"
      FROM (
        SELECT l.complex_id, l.deal_type::text AS deal_type, count(*)::int AS count,
               min(l.price_sort) AS price_min, max(l.price_sort) AS price_max,
               min(l.monthly_rent) AS rent_min, max(l.monthly_rent) AS rent_max
        FROM listings l
        WHERE ${where} AND l.complex_id IS NOT NULL
        GROUP BY l.complex_id, l.deal_type
      ) g
      JOIN complexes c ON c.id = g.complex_id AND c.deleted_at IS NULL
      GROUP BY c.id
      ORDER BY sum(g.count) DESC, c.id
      LIMIT ${limit + 1}`;
    }
    /** Individual markers for listings outside a 단지 (most recent first), limit+1 to detect truncation. */
    listingMarkers(where, limit) {
        return this.prisma.$queryRaw `
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
    listSql(f, bbox, sort, offset, limit) {
        const spec = SORTS[sort];
        const dir = client_1.Prisma.raw(spec.dir);
        const filters = filterConditions(f, bbox);
        const n = offset + limit;
        const segments = spec.nullable
            ? [
                {
                    cond: client_1.Prisma.sql `${spec.key} IS NOT NULL`,
                    order: client_1.Prisma.sql `${spec.key} ${dir}, l.published_at DESC, l.id DESC`,
                    key: spec.key,
                },
                {
                    cond: client_1.Prisma.sql `${spec.key} IS NULL`,
                    order: client_1.Prisma.sql `l.published_at DESC, l.id DESC`,
                    key: spec.key,
                },
            ]
            : [{ cond: null, order: client_1.Prisma.sql `${spec.key} ${dir}, l.id DESC`, key: spec.key }];
        const branches = shared_1.PUBLIC_LISTING_STATUSES.flatMap((status) => segments.map((seg, i) => client_1.Prisma.sql `(
          SELECT l.id, ${i}::int AS seg, ${seg.key} AS k, l.published_at AS pub
          FROM listings l
          WHERE ${and([client_1.Prisma.sql `l.status = ${status}::listing_status`, ...filters, ...(seg.cond ? [seg.cond] : [])])}
          ORDER BY ${seg.order}
          LIMIT ${n})`));
        const tieBreak = spec.nullable ? client_1.Prisma.sql `u.pub DESC, ` : client_1.Prisma.empty;
        return client_1.Prisma.sql `
      SELECT u.id FROM (${client_1.Prisma.join(branches, ' UNION ALL ')}) u
      ORDER BY u.seg, u.k ${dir}, ${tieBreak}u.id DESC
      OFFSET ${offset} LIMIT ${limit}`;
    }
    /**
     * Disclosable co-broker count (ACTIVE links of approved, non-deleted agencies) for one page of
     * listing ids. Scoped to the ids so its cost follows the page size, not the size of
     * listing_agencies (a Prisma relation _count aggregates the whole table before joining).
     */
    agencyCountsSql(ids) {
        return client_1.Prisma.sql `
      SELECT la.listing_id AS "listingId", count(*)::int AS "n"
      FROM listing_agencies la
      JOIN agencies a ON a.id = la.agency_id
        AND a.status = ${shared_1.AgencyStatus.APPROVED}::agency_status AND a.deleted_at IS NULL
      WHERE la.listing_id = ANY(${ids}::uuid[])
        AND la.status = ${shared_1.ListingAgencyStatus.ACTIVE}::listing_agency_status
      GROUP BY la.listing_id`;
    }
    /**
     * Console text search (GET /agency/listings?q): ids of the agency's listings (ACTIVE membership,
     * not deleted) whose 단지명, 건물명, 도로명·지번 주소, 동, 제목 or 매물번호 contain the text, spaces
     * ignored on both sides ("레이크 파크" finds "레이크파크"). 호 is searched only on listings the
     * agency is the primary of (co-brokers never see it). `listingNo` also matches exactly.
     */
    async agencyTextMatchIds(agencyId, text, listingNo) {
        const squashed = text.replace(/\s+/g, '');
        if (!squashed && listingNo === null)
            return [];
        const pattern = `%${squashed.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
        const rows = await this.prisma.$queryRaw `
      SELECT l.id::text AS id
      FROM listings l
      JOIN properties p ON p.id = l.property_id
      LEFT JOIN complexes c ON c.id = l.complex_id
      WHERE l.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM listing_agencies la
          WHERE la.listing_id = l.id AND la.agency_id = ${agencyId}::uuid
            AND la.status = ${shared_1.ListingAgencyStatus.ACTIVE}::listing_agency_status)
        AND (
          regexp_replace(concat_ws(' ', c.name, p.building_name, p.road_address, p.jibun_address,
            p.dong, l.title, l.listing_no::text,
            CASE WHEN l.primary_agency_id = ${agencyId}::uuid THEN p.ho END), '\\s+', '', 'g')
            ILIKE ${pattern}
          OR l.listing_no = ${listingNo}::int
        )`;
        return rows.map((r) => r.id);
    }
    async agencyCounts(ids) {
        if (ids.length === 0)
            return new Map();
        const rows = await this.prisma.$queryRaw(this.agencyCountsSql(ids));
        return new Map(rows.map((r) => [r.listingId, r.n]));
    }
    async listIds(f, bbox, sort, offset, limit) {
        const rows = await this.prisma.$queryRaw(this.listSql(f, bbox, sort, offset, limit));
        return rows.map((r) => r.id);
    }
};
exports.ListingSearchRepository = ListingSearchRepository;
exports.ListingSearchRepository = ListingSearchRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ListingSearchRepository);
//# sourceMappingURL=listing-search.repository.js.map