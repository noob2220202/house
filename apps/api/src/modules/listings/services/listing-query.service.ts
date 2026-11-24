import {
  ErrorCode,
  PUBLIC_LISTING_STATUSES,
  RecentViewTarget,
  type Bbox,
  type ListingDetail,
  type ListingFilter,
  type ListingListQuery,
  type ListingPage,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Principal } from '../../../common/auth/principal';
import { CacheService } from '../../../common/cache/cache.service';
import { AppException } from '../../../common/errors/app.exception';
import { toPaginated } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { LISTINGS_SEARCH_CACHE_NS, MAP_TILE_CACHE_TTL_SECONDS } from '../constants';
import { filterFingerprint } from '../domain/map-tiles';
import { ListingSearchRepository } from '../listing-search.repository';
import { ListingMapper } from '../listing.mapper';
import {
  LISTING_PUBLIC_DETAIL_SELECT,
  LISTING_SUMMARY_SELECT,
  PUBLIC_PRIMARY_AGENCY_WHERE,
} from '../listing.selects';
import { FavoritesService } from './favorites.service';
import { ListingViewsService } from './listing-views.service';
import { ListingRegionNamesService } from './listing-region-names.service';
import { ListingSummariesService } from './listing-summaries.service';
import { RecentViewsService } from './recent-views.service';

/** Public read side: sorted/paginated search and the listing detail page. */
@Injectable()
export class ListingQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: ListingSearchRepository,
    private readonly mapper: ListingMapper,
    private readonly views: ListingViewsService,
    private readonly recent: RecentViewsService,
    private readonly favorites: FavoritesService,
    private readonly summaries: ListingSummariesService,
    private readonly regionNames: ListingRegionNamesService,
    private readonly cache: CacheService,
  ) {}

  async list(q: ListingListQuery): Promise<ListingPage> {
    const { page, pageSize, sort, bbox, ...filter } = q;
    const offset = (page - 1) * pageSize;
    const [ids, total] = await Promise.all([
      this.search.listIds(filter, bbox, sort, offset, pageSize),
      this.total(filter, bbox),
    ]);
    const rows =
      ids.length === 0
        ? []
        : await this.prisma.listing.findMany({
            where: { id: { in: ids } },
            select: LISTING_SUMMARY_SELECT,
          });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const items = await this.summaries.map(
      ids.flatMap((id) => {
        const row = byId.get(id);
        return row ? [row] : [];
      }),
    );
    return toPaginated(items, total, { page, pageSize });
  }

  /**
   * Total matches for (filter, bbox): a full count of the matching rows, so it is cached like map
   * tiles (same version namespace, bumped on every public-data write; the TTL bounds staleness).
   * Independent of page and sort, so paging through results reuses it.
   */
  private async total(filter: ListingFilter, bbox: Bbox | undefined): Promise<number> {
    const version = await this.cache.version(LISTINGS_SEARCH_CACHE_NS);
    const area = bbox ? `${bbox.swLng},${bbox.swLat},${bbox.neLng},${bbox.neLat}` : 'all';
    return this.cache.getOrSet(
      `cache:listings:list-total:v${version}:${area}:${filterFingerprint(filter)}`,
      MAP_TILE_CACHE_TTL_SECONDS,
      () => this.search.count(this.search.publicWhere(filter, bbox)),
    );
  }

  /**
   * Public detail of an ACTIVE/RESERVED listing; counts a deduped view and a recent view unless
   * `recordView` is false (the Next.js SSR read: the browser beacon counts instead), in which case
   * `viewCount` is the current total without counting.
   */
  async detail(
    id: string,
    principal: Principal | undefined,
    opts: { recordView?: boolean } = {},
  ): Promise<ListingDetail> {
    const recordView = opts.recordView ?? true;
    const row = await this.prisma.listing.findFirst({
      where: {
        id,
        deletedAt: null,
        status: { in: [...PUBLIC_LISTING_STATUSES] },
        ...PUBLIC_PRIMARY_AGENCY_WHERE,
      },
      select: LISTING_PUBLIC_DETAIL_SELECT,
    });
    if (!row) throw AppException.notFound(ErrorCode.LISTING_NOT_FOUND);
    const userId = principal?.kind === 'USER' ? principal.userId : null;
    const [viewCount, isFavorite, emdName] = await Promise.all([
      recordView
        ? this.views.record(row.id, this.views.viewerKey(principal), row.viewCount, row)
        : this.views.current(row.id, row.viewCount),
      userId ? this.favorites.isFavorite(userId, row.id) : Promise.resolve(false),
      this.regionNames.nameOf(row.emdCode),
      userId && recordView
        ? this.recent.record(userId, RecentViewTarget.LISTING, row.id)
        : Promise.resolve(),
    ]);
    return { ...this.mapper.publicDetail(row, isFavorite, emdName), viewCount };
  }

  /**
   * POST /listings/:id/view — the browser-side view beacon: counts a view (same per-viewer dedupe
   * as a counting detail read, so a direct read + beacon count once) and, for a signed-in user, the recent view.
   */
  async recordView(id: string, principal: Principal | undefined): Promise<void> {
    const row = await this.prisma.listing.findFirst({
      where: {
        id,
        deletedAt: null,
        status: { in: [...PUBLIC_LISTING_STATUSES] },
        ...PUBLIC_PRIMARY_AGENCY_WHERE,
      },
      select: { id: true, viewCount: true, assetType: true, emdCode: true },
    });
    if (!row) throw AppException.notFound(ErrorCode.LISTING_NOT_FOUND);
    await Promise.all([
      this.views.record(row.id, this.views.viewerKey(principal), row.viewCount, row),
      principal?.kind === 'USER'
        ? this.recent.record(principal.userId, RecentViewTarget.LISTING, row.id)
        : Promise.resolve(),
    ]);
  }
}
