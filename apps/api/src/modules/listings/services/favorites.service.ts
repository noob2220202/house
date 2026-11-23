import {
  ErrorCode,
  ListingStatus,
  PUBLIC_LISTING_STATUSES,
  type FavoriteListingItem,
  type Paginated,
  type PaginationQuery,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListingMapper } from '../listing.mapper';
import { LISTING_SUMMARY_SELECT } from '../listing.selects';

/** Favorites stay listed after a deal closes (shown as 거래완료); drafts/hidden/deleted drop out. */
const FAVORITE_VISIBLE_STATUSES = [...PUBLIC_LISTING_STATUSES, ListingStatus.CLOSED];

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ListingMapper,
  ) {}

  /** Idempotent: favoriting twice keeps one row and counts once. */
  async add(userId: string, listingId: string): Promise<{ listingId: string; favorited: true }> {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, deletedAt: null, status: { in: [...PUBLIC_LISTING_STATUSES] } },
      select: { id: true },
    });
    if (!listing) throw AppException.notFound(ErrorCode.LISTING_NOT_FOUND);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.favoriteListing.createMany({
        data: [{ userId, listingId }],
        skipDuplicates: true,
      });
      if (count > 0) {
        await tx.listing.update({
          where: { id: listingId },
          data: { favoriteCount: { increment: 1 } },
        });
      }
    });
    return { listingId, favorited: true };
  }

  async remove(userId: string, listingId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.favoriteListing.deleteMany({ where: { userId, listingId } });
      if (count > 0) {
        await tx.$executeRaw`
          UPDATE listings SET favorite_count = GREATEST(favorite_count - 1, 0)
          WHERE id = ${listingId}::uuid`;
      }
    });
  }

  async list(userId: string, q: PaginationQuery): Promise<Paginated<FavoriteListingItem>> {
    const where = {
      userId,
      listing: { deletedAt: null, status: { in: FAVORITE_VISIBLE_STATUSES } },
    };
    return paginate(
      q,
      async (args) => {
        const rows = await this.prisma.favoriteListing.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, listing: { select: LISTING_SUMMARY_SELECT } },
          ...args,
        });
        return rows.map((r) => ({
          favoritedAt: r.createdAt.toISOString(),
          listing: this.mapper.summary(r.listing),
        }));
      },
      () => this.prisma.favoriteListing.count({ where }),
    );
  }

  async isFavorite(userId: string, listingId: string): Promise<boolean> {
    const row = await this.prisma.favoriteListing.findUnique({
      where: { userId_listingId: { userId, listingId } },
      select: { userId: true },
    });
    return row !== null;
  }
}
