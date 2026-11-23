import {
  ErrorCode,
  PUBLIC_LISTING_STATUSES,
  RecentViewTarget,
  type ListingDetail,
  type ListingListQuery,
  type ListingPage,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Principal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { toPaginated } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListingSearchRepository } from '../listing-search.repository';
import { ListingMapper } from '../listing.mapper';
import { LISTING_PUBLIC_DETAIL_SELECT, LISTING_SUMMARY_SELECT } from '../listing.selects';
import { FavoritesService } from './favorites.service';
import { ListingViewsService } from './listing-views.service';
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
  ) {}

  async list(q: ListingListQuery): Promise<ListingPage> {
    const { page, pageSize, sort, bbox, ...filter } = q;
    const offset = (page - 1) * pageSize;
    const [ids, total] = await Promise.all([
      this.search.listIds(filter, bbox, sort, offset, pageSize),
      this.search.count(this.search.publicWhere(filter, bbox)),
    ]);
    const rows =
      ids.length === 0
        ? []
        : await this.prisma.listing.findMany({
            where: { id: { in: ids } },
            select: LISTING_SUMMARY_SELECT,
          });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const items = ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [this.mapper.summary(row)] : [];
    });
    return toPaginated(items, total, { page, pageSize });
  }

  /** Public detail of an ACTIVE/RESERVED listing; counts a deduped view and a recent view. */
  async detail(id: string, principal: Principal | undefined): Promise<ListingDetail> {
    const row = await this.prisma.listing.findFirst({
      where: { id, deletedAt: null, status: { in: [...PUBLIC_LISTING_STATUSES] } },
      select: LISTING_PUBLIC_DETAIL_SELECT,
    });
    if (!row) throw AppException.notFound(ErrorCode.LISTING_NOT_FOUND);
    const userId = principal?.kind === 'USER' ? principal.userId : null;
    const [viewCount, isFavorite] = await Promise.all([
      this.views.record(row.id, this.views.viewerKey(principal), row.viewCount),
      userId ? this.favorites.isFavorite(userId, row.id) : Promise.resolve(false),
      userId ? this.recent.record(userId, RecentViewTarget.LISTING, row.id) : Promise.resolve(),
    ]);
    return { ...this.mapper.publicDetail(row, isFavorite), viewCount };
  }
}
