import { type AgencyMapQuery, type AgencyMapResult, type AgencyProfile, type AgencySearchItem, type AgencySearchQuery, type Bbox, type Paginated } from '@house/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgencyMapper } from '../agency.mapper';
import { AgencySearchRepository, type AgencyFilter } from '../agency-search.repository';
import { type AgencyListingsReader } from '../ports/agency-listings.reader';
import { type AgencyMediaPort } from '../ports/agency-media.port';
import { AgencyCacheService } from './agency-cache.service';
/** `GET /agencies/regions` — 읍면동 facet of the office search's 지역 filter. */
export interface AgencyRegionFacet {
    /** All approved offices (also those without a 읍면동 code). */
    total: number;
    items: {
        emdCode: string;
        name: string;
        count: number;
        lat: number | null;
        lng: number | null;
    }[];
}
/** Expands a bbox to tile boundaries (4 grid cells) so nearby viewports share a cache entry. */
export declare function tileAlignedBbox(b: Bbox, zoom: number): Bbox;
export declare function filterFingerprint(f: Pick<AgencyFilter, 'q' | 'specialties'>): string;
/** 중개사무소 찾기: list search, map clusters/markers and the public profile (APPROVED only). */
export declare class AgencyPublicService {
    private readonly prisma;
    private readonly repo;
    private readonly mapper;
    private readonly cache;
    private readonly listings;
    private readonly media;
    constructor(prisma: PrismaService, repo: AgencySearchRepository, mapper: AgencyMapper, cache: AgencyCacheService, listings: AgencyListingsReader, media: AgencyMediaPort);
    /**
     * Office search. `openNow` evaluates the 영업시간 at `now` in Asia/Seoul (offices without hours
     * drop out); `handlesPresale` keeps offices advertising a public 분양권 listing.
     */
    search(q: AgencySearchQuery, now?: Date): Promise<Paginated<AgencySearchItem>>;
    /** Cached (public version namespace, bumped on approvals / profile changes). */
    regions(): Promise<AgencyRegionFacet>;
    map(q: AgencyMapQuery): Promise<AgencyMapResult>;
    profile(agencyId: string): Promise<AgencyProfile>;
    private loadProfile;
}
