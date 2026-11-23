import { createHash } from 'node:crypto';
import {
  AgencyMemberRole,
  AgencyMemberStatus,
  AgencyStatus,
  ErrorCode,
  MAP_MAX_MARKERS,
  MapResultKind,
  mapResultKindForZoom,
  toAgencyDisclosure,
  type AgencyMapQuery,
  type AgencyMapResult,
  type AgencyProfile,
  type AgencySearchQuery,
  type AgencySummary,
  type Bbox,
  type Paginated,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import { gridSizeForZoom } from '../../../common/geo/geo';
import { toPaginated, toSkipTake } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgencyMapper, toBusinessHours } from '../agency.mapper';
import { agencyProfileSelect, agencySummarySelect } from '../agency.selects';
import { AgencySearchRepository, type AgencyFilter } from '../agency-search.repository';
import {
  MAP_CACHE_TTL_SECONDS,
  PROFILE_CACHE_TTL_SECONDS,
  PROFILE_MEMBERS_LIMIT,
  REPRESENTATIVE_LISTINGS_LIMIT,
} from '../constants';
import { AGENCY_LISTINGS_READER, type AgencyListingsReader } from '../ports/agency-listings.reader';
import { AGENCY_MEDIA, type AgencyMediaPort } from '../ports/agency-media.port';
import { AgencyCacheService } from './agency-cache.service';

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

/** Expands a bbox to tile boundaries (4 grid cells) so nearby viewports share a cache entry. */
export function tileAlignedBbox(b: Bbox, zoom: number): Bbox {
  const t = gridSizeForZoom(zoom) * 4;
  return {
    swLng: round6(Math.floor(b.swLng / t) * t),
    swLat: round6(Math.floor(b.swLat / t) * t),
    neLng: round6(Math.ceil(b.neLng / t) * t),
    neLat: round6(Math.ceil(b.neLat / t) * t),
  };
}

export function filterFingerprint(f: Pick<AgencyFilter, 'q' | 'specialties'>): string {
  const normalized = JSON.stringify([f.q ?? null, [...(f.specialties ?? [])].sort()]);
  return createHash('sha1').update(normalized).digest('hex').slice(0, 16);
}

/** 중개사무소 찾기: list search, map clusters/markers and the public profile (APPROVED only). */
@Injectable()
export class AgencyPublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: AgencySearchRepository,
    private readonly mapper: AgencyMapper,
    private readonly cache: AgencyCacheService,
    @Inject(AGENCY_LISTINGS_READER) private readonly listings: AgencyListingsReader,
    @Inject(AGENCY_MEDIA) private readonly media: AgencyMediaPort,
  ) {}

  async search(q: AgencySearchQuery): Promise<Paginated<AgencySummary>> {
    const filter: AgencyFilter = {
      q: q.q,
      emdCode: q.emdCode,
      bbox: q.bbox,
      specialties: q.specialties,
    };
    const [ids, total] = await Promise.all([
      this.repo.searchIds(filter, q.sort, toSkipTake(q)),
      this.repo.count(filter),
    ]);
    const rows = ids.length
      ? await this.prisma.agency.findMany({
          where: { id: { in: ids } },
          select: agencySummarySelect,
        })
      : [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const items = ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [this.mapper.summary(row)] : [];
    });
    return toPaginated(items, total, q);
  }

  async map(q: AgencyMapQuery): Promise<AgencyMapResult> {
    const zoom = Math.round(q.zoom);
    const kind = mapResultKindForZoom(zoom);
    const bbox = tileAlignedBbox(q.bbox, zoom);
    const filter: AgencyFilter = { q: q.q, specialties: q.specialties, bbox };
    const b = bbox;
    const key = await this.cache.publicKey(
      'map',
      kind,
      zoom,
      `${b.swLng},${b.swLat},${b.neLng},${b.neLat}`,
      filterFingerprint(filter),
    );
    return this.cache.getOrSet(key, MAP_CACHE_TTL_SECONDS, async (): Promise<AgencyMapResult> => {
      switch (kind) {
        case MapResultKind.REGION_CLUSTERS:
          return { kind, clusters: await this.repo.regionClusters(filter) };
        case MapResultKind.GRID_CLUSTERS:
          return { kind, clusters: await this.repo.gridClusters(filter, gridSizeForZoom(zoom)) };
        case MapResultKind.MARKERS:
        default: {
          const rows = await this.repo.markers(filter, MAP_MAX_MARKERS);
          const truncated = rows.length > MAP_MAX_MARKERS;
          return {
            kind: MapResultKind.MARKERS,
            truncated,
            markers: rows.slice(0, MAP_MAX_MARKERS).map((r) => ({
              id: r.id,
              name: r.name,
              lat: r.lat,
              lng: r.lng,
              activeListingCount: r.activeListingCount,
              logoUrl: r.logoStorageKey
                ? this.media.publicUrl({ storageKey: r.logoStorageKey, variants: r.logoVariants })
                : null,
            })),
          };
        }
      }
    });
  }

  async profile(agencyId: string): Promise<AgencyProfile> {
    const key = await this.cache.publicKey('profile', agencyId);
    const cached = await this.cache.getOrSet<AgencyProfile | null>(
      key,
      PROFILE_CACHE_TTL_SECONDS,
      () => this.loadProfile(agencyId),
    );
    if (!cached) throw AppException.notFound(ErrorCode.AGENCY_NOT_FOUND);
    return cached;
  }

  private async loadProfile(agencyId: string): Promise<AgencyProfile | null> {
    const row = await this.prisma.agency.findFirst({
      where: { id: agencyId, status: AgencyStatus.APPROVED, deletedAt: null },
      select: {
        ...agencyProfileSelect,
        // 제18조의2①: this page shows the office's 중개대상물 ads, so it names only the
        // 개업공인중개사 and 소속공인중개사 (isAdvertisableMember), never a 중개보조원.
        members: {
          where: {
            status: AgencyMemberStatus.ACTIVE,
            OR: [{ role: AgencyMemberRole.OWNER }, { isLicensed: true }],
          },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
          take: PROFILE_MEMBERS_LIMIT,
          select: { id: true, displayName: true, title: true, role: true, isLicensed: true },
        },
      },
    });
    if (!row) return null;
    const [listingCounts, representativeListings] = await Promise.all([
      this.listings.counts(agencyId),
      this.listings.representative(agencyId, REPRESENTATIVE_LISTINGS_LIMIT),
    ]);
    return {
      ...this.mapper.summary(row),
      mobile: row.mobile,
      email: row.email,
      jibunAddress: row.jibunAddress,
      intro: row.intro,
      businessHours: toBusinessHours(row.businessHours),
      approvedAt: row.approvedAt?.toISOString() ?? null,
      warningCount: row.warningCount,
      members: row.members,
      listingCounts,
      representativeListings,
      disclosure: toAgencyDisclosure(row),
    };
  }
}
