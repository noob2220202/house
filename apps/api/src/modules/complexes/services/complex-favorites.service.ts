import { Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type FavoriteComplexItem,
  type Paginated,
  type PaginationQuery,
} from '@house/shared';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { COMPLEX_SUMMARY_SELECT, toComplexSummary } from '../complex.mapper';

/** 관심 단지. Rows are always scoped by the caller's userId (no IDOR). */
@Injectable()
export class ComplexFavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent: favoriting twice keeps one row and counts once. */
  async add(userId: string, complexId: string): Promise<{ complexId: string; favorited: true }> {
    const exists = await this.prisma.complex.count({ where: { id: complexId, deletedAt: null } });
    if (exists === 0) throw AppException.notFound(ErrorCode.COMPLEX_NOT_FOUND);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.favoriteComplex.createMany({
        data: [{ userId, complexId }],
        skipDuplicates: true,
      });
      if (count > 0) {
        await tx.complex.update({
          where: { id: complexId },
          data: { favoriteCount: { increment: 1 } },
        });
      }
    });
    return { complexId, favorited: true };
  }

  async remove(userId: string, complexId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.favoriteComplex.deleteMany({ where: { userId, complexId } });
      if (count > 0) {
        await tx.$executeRaw`
          UPDATE complexes SET favorite_count = GREATEST(favorite_count - 1, 0)
          WHERE id = ${complexId}::uuid`;
      }
    });
  }

  list(userId: string, q: PaginationQuery): Promise<Paginated<FavoriteComplexItem>> {
    const where = { userId, complex: { deletedAt: null } };
    return paginate(
      q,
      async (args) =>
        (
          await this.prisma.favoriteComplex.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { complexId: 'asc' }],
            select: { createdAt: true, complex: { select: COMPLEX_SUMMARY_SELECT } },
            ...args,
          })
        ).map((r) => ({
          favoritedAt: r.createdAt.toISOString(),
          complex: toComplexSummary(r.complex),
        })),
      () => this.prisma.favoriteComplex.count({ where }),
    );
  }

  async isFavorite(userId: string, complexId: string): Promise<boolean> {
    const row = await this.prisma.favoriteComplex.findUnique({
      where: { userId_complexId: { userId, complexId } },
      select: { userId: true },
    });
    return row !== null;
  }
}
