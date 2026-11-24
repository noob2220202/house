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
exports.AgencySearchRepository = void 0;
exports.kstClock = kstClock;
exports.escapeLike = escapeLike;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const geo_1 = require("../../common/geo/geo");
const prisma_service_1 = require("../../prisma/prisma.service");
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
/** getUTCDay() (0 = Sunday) → BusinessHours key. */
const WEEKDAY_BY_UTC_DAY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
/** Same clock shared `isOpenAt` evaluates (KST, minute precision). */
function kstClock(now) {
    const kst = new Date(now.getTime() + KST_OFFSET_MS);
    return {
        day: WEEKDAY_BY_UTC_DAY[kst.getUTCDay()],
        time: kst.toISOString().slice(11, 16),
    };
}
const PUBLIC_LISTING_STATUS_SQL = client_1.Prisma.join(shared_1.PUBLIC_LISTING_STATUSES.map((st) => client_1.Prisma.sql `${st}::listing_status`));
/** `%` / `_` / `\` are literal in user search text. */
function escapeLike(s) {
    return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
/**
 * Raw PostGIS / trigram queries over APPROVED agencies. Every value is a bound parameter
 * (Prisma.sql), never concatenated. Text search uses the gin_trgm indexes on name,
 * representative_name and road_address; bbox uses the GIST index on location.
 */
let AgencySearchRepository = class AgencySearchRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    where(f) {
        const parts = [
            client_1.Prisma.sql `a.deleted_at IS NULL`,
            client_1.Prisma.sql `a.status = ${shared_1.AgencyStatus.APPROVED}::agency_status`,
        ];
        if (f.q) {
            const like = `%${escapeLike(f.q)}%`;
            parts.push(client_1.Prisma.sql `(a.name ILIKE ${like} OR a.representative_name ILIKE ${like} OR a.road_address ILIKE ${like})`);
        }
        if (f.emdCode) {
            const prefix = `${f.emdCode}%`;
            parts.push(f.emdCode.length >= shared_1.REGION_CODE_LENGTH.EMD
                ? client_1.Prisma.sql `a.emd_code LIKE ${prefix}`
                : client_1.Prisma.sql `a.sgg_code LIKE ${prefix}`);
        }
        if (f.bbox)
            parts.push((0, geo_1.withinBbox)(client_1.Prisma.raw('a.location'), f.bbox));
        if (f.specialties?.length) {
            parts.push(client_1.Prisma.sql `a.specialties && ${f.specialties}::asset_type[]`);
        }
        if (f.openAt) {
            // businessHoursSchema guarantees zero-padded "HH:MM" (close may be "24:00") with open <
            // close, so text comparison is time comparison. A missing / null day (휴무) or no 영업시간
            // at all yields NULL → not open.
            const { day, time } = f.openAt;
            parts.push(client_1.Prisma.sql `(a.business_hours -> ${day}::text ->> 'open') <= ${time}
        AND ${time} < (a.business_hours -> ${day}::text ->> 'close')`);
        }
        if (f.handlesPresale)
            parts.push(this.handlesPresaleSql());
        return client_1.Prisma.join(parts, ' AND ');
    }
    /**
     * The office advertises (ACTIVE ListingAgency row) a public 분양권 listing — one the public site
     * shows, so its primary agency must be disclosable too (same rule as the listings search).
     */
    handlesPresaleSql() {
        return client_1.Prisma.sql `EXISTS (
      SELECT 1 FROM listing_agencies la
      JOIN listings l ON l.id = la.listing_id
      JOIN agencies pa ON pa.id = l.primary_agency_id
      WHERE la.agency_id = a.id
        AND la.status = ${shared_1.ListingAgencyStatus.ACTIVE}::listing_agency_status
        AND l.deal_type = ${shared_1.DealType.PRESALE}::deal_type
        AND l.status IN (${PUBLIC_LISTING_STATUS_SQL})
        AND l.deleted_at IS NULL
        AND pa.status = ${shared_1.AgencyStatus.APPROVED}::agency_status
        AND pa.deleted_at IS NULL)`;
    }
    /** Ids (of `ids`) of offices that advertise a public 분양권 listing. */
    async presaleAgencyIds(ids) {
        if (ids.length === 0)
            return new Set();
        const rows = await this.prisma.$queryRaw `
      SELECT a.id::text AS id FROM agencies a
      WHERE a.id = ANY(${[...ids]}::uuid[]) AND ${this.handlesPresaleSql()}`;
        return new Set(rows.map((r) => r.id));
    }
    orderBy(sort, q) {
        switch (sort) {
            case shared_1.AgencySearchSort.NEWEST:
                return client_1.Prisma.sql `a.approved_at DESC NULLS LAST, a.id DESC`;
            case shared_1.AgencySearchSort.NAME:
                return client_1.Prisma.sql `a.name ASC, a.id ASC`;
            case shared_1.AgencySearchSort.RELEVANCE:
                if (q) {
                    return client_1.Prisma.sql `GREATEST(similarity(a.name, ${q}), similarity(a.representative_name, ${q}), similarity(a.road_address, ${q})) DESC, a.active_listing_count DESC, a.id ASC`;
                }
                return client_1.Prisma.sql `a.active_listing_count DESC, a.approved_at DESC NULLS LAST, a.id ASC`;
            case shared_1.AgencySearchSort.LISTINGS:
            default:
                return client_1.Prisma.sql `a.active_listing_count DESC, a.approved_at DESC NULLS LAST, a.id ASC`;
        }
    }
    async searchIds(f, sort, page) {
        const rows = await this.prisma.$queryRaw `
      SELECT a.id::text AS id FROM agencies a
      WHERE ${this.where(f)}
      ORDER BY ${this.orderBy(sort, f.q)}
      LIMIT ${page.take} OFFSET ${page.skip}`;
        return rows.map((r) => r.id);
    }
    async count(f) {
        const [row] = await this.prisma.$queryRaw `
      SELECT count(*)::int AS count FROM agencies a WHERE ${this.where(f)}`;
        return row?.count ?? 0;
    }
    /** Low zoom: one cluster per 읍면동 (offices without one fall back to their 시군구). */
    async regionClusters(f) {
        return this.prisma.$queryRaw `
      SELECT c.code, r.name, c.lat, c.lng, c.count
      FROM (
        SELECT COALESCE(LEFT(a.emd_code, ${shared_1.REGION_CODE_LENGTH.EMD}::int), a.sgg_code) AS code,
               avg(a.lat)::float8 AS lat, avg(a.lng)::float8 AS lng, count(*)::int AS count
        FROM agencies a
        WHERE ${this.where(f)}
        GROUP BY 1
      ) c
      LEFT JOIN regions r ON r.code = c.code
      ORDER BY c.count DESC, c.code ASC
      LIMIT ${shared_1.MAP_MAX_MARKERS}`;
    }
    /**
     * 읍면동 facet of APPROVED offices (`GET /agencies/regions`): one row per 8-digit 읍면동 code
     * (리 codes roll up to their 읍면), named from `regions` (8-digit row, else its 10-digit "…00"
     * twin); the point is the region centroid, else the offices' mean position.
     */
    async regionFacet() {
        return this.prisma.$queryRaw `
      SELECT c.code AS "emdCode", r.name, c.count,
             COALESCE(r.lat, c.lat) AS lat, COALESCE(r.lng, c.lng) AS lng
      FROM (
        SELECT LEFT(a.emd_code, ${shared_1.REGION_CODE_LENGTH.EMD}::int) AS code,
               avg(a.lat)::float8 AS lat, avg(a.lng)::float8 AS lng, count(*)::int AS count
        FROM agencies a
        WHERE ${this.where({})} AND length(a.emd_code) >= ${shared_1.REGION_CODE_LENGTH.EMD}::int
        GROUP BY 1
      ) c
      LEFT JOIN LATERAL (
        SELECT rg.name, rg.lat, rg.lng FROM regions rg
        WHERE rg.code IN (c.code, c.code || '00') AND rg.level <> 'RI'::region_level
        ORDER BY length(rg.code) ASC
        LIMIT 1
      ) r ON true
      ORDER BY c.count DESC, r.name ASC NULLS LAST, c.code ASC`;
    }
    /** Mid zoom: grid clustering (cells aligned to the origin, so tiles never split a cell). */
    async gridClusters(f, gridSize) {
        return this.prisma.$queryRaw `
      SELECT avg(a.lat)::float8 AS lat, avg(a.lng)::float8 AS lng, count(*)::int AS count
      FROM agencies a
      WHERE ${this.where(f)}
      GROUP BY ST_SnapToGrid(a.location::geometry, ${gridSize}::float8)
      ORDER BY count DESC
      LIMIT ${shared_1.MAP_MAX_MARKERS}`;
    }
    /** High zoom: individual offices, busiest first; fetches one extra row to detect truncation. */
    async markers(f, limit) {
        return this.prisma.$queryRaw `
      SELECT a.id::text AS id, a.name, a.lat, a.lng,
             a.active_listing_count AS "activeListingCount",
             m.storage_key AS "logoStorageKey", m.variants AS "logoVariants"
      FROM agencies a
      LEFT JOIN media m ON m.id = a.logo_media_id AND m.deleted_at IS NULL
      WHERE ${this.where(f)}
      ORDER BY a.active_listing_count DESC, a.id ASC
      LIMIT ${limit + 1}`;
    }
};
exports.AgencySearchRepository = AgencySearchRepository;
exports.AgencySearchRepository = AgencySearchRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AgencySearchRepository);
//# sourceMappingURL=agency-search.repository.js.map