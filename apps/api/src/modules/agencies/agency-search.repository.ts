import {
  AgencySearchSort,
  AgencyStatus,
  MAP_MAX_MARKERS,
  REGION_CODE_LENGTH,
  type AgencyGridCluster,
  type AgencyRegionCluster,
  type AssetType,
  type Bbox,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { withinBbox } from '../../common/geo/geo';
import { PrismaService } from '../../prisma/prisma.service';

export interface AgencyFilter {
  q?: string;
  emdCode?: string;
  bbox?: Bbox;
  specialties?: AssetType[];
}

export interface MarkerRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  activeListingCount: number;
  logoStorageKey: string | null;
  logoVariants: Prisma.JsonValue | null;
}

/** `%` / `_` / `\` are literal in user search text. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Raw PostGIS / trigram queries over APPROVED agencies. Every value is a bound parameter
 * (Prisma.sql), never concatenated. Text search uses the gin_trgm indexes on name,
 * representative_name and road_address; bbox uses the GIST index on location.
 */
@Injectable()
export class AgencySearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  where(f: AgencyFilter): Prisma.Sql {
    const parts: Prisma.Sql[] = [
      Prisma.sql`a.deleted_at IS NULL`,
      Prisma.sql`a.status = ${AgencyStatus.APPROVED}::agency_status`,
    ];
    if (f.q) {
      const like = `%${escapeLike(f.q)}%`;
      parts.push(
        Prisma.sql`(a.name ILIKE ${like} OR a.representative_name ILIKE ${like} OR a.road_address ILIKE ${like})`,
      );
    }
    if (f.emdCode) {
      const prefix = `${f.emdCode}%`;
      parts.push(
        f.emdCode.length >= REGION_CODE_LENGTH.EMD
          ? Prisma.sql`a.emd_code LIKE ${prefix}`
          : Prisma.sql`a.sgg_code LIKE ${prefix}`,
      );
    }
    if (f.bbox) parts.push(withinBbox(Prisma.raw('a.location'), f.bbox));
    if (f.specialties?.length) {
      parts.push(Prisma.sql`a.specialties && ${f.specialties}::asset_type[]`);
    }
    return Prisma.join(parts, ' AND ');
  }

  private orderBy(sort: AgencySearchSort, q: string | undefined): Prisma.Sql {
    switch (sort) {
      case AgencySearchSort.NEWEST:
        return Prisma.sql`a.approved_at DESC NULLS LAST, a.id DESC`;
      case AgencySearchSort.NAME:
        return Prisma.sql`a.name ASC, a.id ASC`;
      case AgencySearchSort.RELEVANCE:
        if (q) {
          return Prisma.sql`GREATEST(similarity(a.name, ${q}), similarity(a.representative_name, ${q}), similarity(a.road_address, ${q})) DESC, a.active_listing_count DESC, a.id ASC`;
        }
        return Prisma.sql`a.active_listing_count DESC, a.approved_at DESC NULLS LAST, a.id ASC`;
      case AgencySearchSort.LISTINGS:
      default:
        return Prisma.sql`a.active_listing_count DESC, a.approved_at DESC NULLS LAST, a.id ASC`;
    }
  }

  async searchIds(
    f: AgencyFilter,
    sort: AgencySearchSort,
    page: { skip: number; take: number },
  ): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT a.id::text AS id FROM agencies a
      WHERE ${this.where(f)}
      ORDER BY ${this.orderBy(sort, f.q)}
      LIMIT ${page.take} OFFSET ${page.skip}`;
    return rows.map((r) => r.id);
  }

  async count(f: AgencyFilter): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count FROM agencies a WHERE ${this.where(f)}`;
    return row?.count ?? 0;
  }

  /** Low zoom: one cluster per 읍면동 (offices without one fall back to their 시군구). */
  async regionClusters(f: AgencyFilter): Promise<AgencyRegionCluster[]> {
    return this.prisma.$queryRaw<AgencyRegionCluster[]>`
      SELECT c.code, r.name, c.lat, c.lng, c.count
      FROM (
        SELECT COALESCE(LEFT(a.emd_code, ${REGION_CODE_LENGTH.EMD}::int), a.sgg_code) AS code,
               avg(a.lat)::float8 AS lat, avg(a.lng)::float8 AS lng, count(*)::int AS count
        FROM agencies a
        WHERE ${this.where(f)}
        GROUP BY 1
      ) c
      LEFT JOIN regions r ON r.code = c.code
      ORDER BY c.count DESC, c.code ASC
      LIMIT ${MAP_MAX_MARKERS}`;
  }

  /** Mid zoom: grid clustering (cells aligned to the origin, so tiles never split a cell). */
  async gridClusters(f: AgencyFilter, gridSize: number): Promise<AgencyGridCluster[]> {
    return this.prisma.$queryRaw<AgencyGridCluster[]>`
      SELECT avg(a.lat)::float8 AS lat, avg(a.lng)::float8 AS lng, count(*)::int AS count
      FROM agencies a
      WHERE ${this.where(f)}
      GROUP BY ST_SnapToGrid(a.location::geometry, ${gridSize}::float8)
      ORDER BY count DESC
      LIMIT ${MAP_MAX_MARKERS}`;
  }

  /** High zoom: individual offices, busiest first; fetches one extra row to detect truncation. */
  async markers(f: AgencyFilter, limit: number): Promise<MarkerRow[]> {
    return this.prisma.$queryRaw<MarkerRow[]>`
      SELECT a.id::text AS id, a.name, a.lat, a.lng,
             a.active_listing_count AS "activeListingCount",
             m.storage_key AS "logoStorageKey", m.variants AS "logoVariants"
      FROM agencies a
      LEFT JOIN media m ON m.id = a.logo_media_id AND m.deleted_at IS NULL
      WHERE ${this.where(f)}
      ORDER BY a.active_listing_count DESC, a.id ASC
      LIMIT ${limit + 1}`;
  }
}
