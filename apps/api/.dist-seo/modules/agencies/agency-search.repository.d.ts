import { AgencySearchSort, type AgencyGridCluster, type AgencyRegionCluster, type AssetType, type Bbox, type Weekday } from '@house/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
export interface AgencyFilter {
    q?: string;
    emdCode?: string;
    bbox?: Bbox;
    specialties?: AssetType[];
    /** Open at this KST moment by the stored 영업시간 (see `kstClock`). */
    openAt?: KstClock;
    /** Advertises at least one public 분양권 listing. */
    handlesPresale?: boolean;
}
/** A moment in Asia/Seoul as the 영업시간 JSON keys it: weekday key + "HH:MM". */
export interface KstClock {
    day: Weekday;
    time: string;
}
/** Same clock shared `isOpenAt` evaluates (KST, minute precision). */
export declare function kstClock(now: Date): KstClock;
export interface RegionFacetRow {
    emdCode: string;
    name: string | null;
    count: number;
    lat: number | null;
    lng: number | null;
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
export declare function escapeLike(s: string): string;
/**
 * Raw PostGIS / trigram queries over APPROVED agencies. Every value is a bound parameter
 * (Prisma.sql), never concatenated. Text search uses the gin_trgm indexes on name,
 * representative_name and road_address; bbox uses the GIST index on location.
 */
export declare class AgencySearchRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    where(f: AgencyFilter): Prisma.Sql;
    /**
     * The office advertises (ACTIVE ListingAgency row) a public 분양권 listing — one the public site
     * shows, so its primary agency must be disclosable too (same rule as the listings search).
     */
    private handlesPresaleSql;
    /** Ids (of `ids`) of offices that advertise a public 분양권 listing. */
    presaleAgencyIds(ids: readonly string[]): Promise<Set<string>>;
    private orderBy;
    searchIds(f: AgencyFilter, sort: AgencySearchSort, page: {
        skip: number;
        take: number;
    }): Promise<string[]>;
    count(f: AgencyFilter): Promise<number>;
    /** Low zoom: one cluster per 읍면동 (offices without one fall back to their 시군구). */
    regionClusters(f: AgencyFilter): Promise<AgencyRegionCluster[]>;
    /**
     * 읍면동 facet of APPROVED offices (`GET /agencies/regions`): one row per 8-digit 읍면동 code
     * (리 codes roll up to their 읍면), named from `regions` (8-digit row, else its 10-digit "…00"
     * twin); the point is the region centroid, else the offices' mean position.
     */
    regionFacet(): Promise<RegionFacetRow[]>;
    /** Mid zoom: grid clustering (cells aligned to the origin, so tiles never split a cell). */
    gridClusters(f: AgencyFilter, gridSize: number): Promise<AgencyGridCluster[]>;
    /** High zoom: individual offices, busiest first; fetches one extra row to detect truncation. */
    markers(f: AgencyFilter, limit: number): Promise<MarkerRow[]>;
}
