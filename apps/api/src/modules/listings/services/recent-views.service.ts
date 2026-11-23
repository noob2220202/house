import {
  PUBLIC_LISTING_STATUSES,
  RecentViewTarget,
  type Paginated,
  type RecentViewItem,
  type RecentViewsQuery,
} from '@house/shared';
import { Injectable, Logger } from '@nestjs/common';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { RECENT_VIEWS_CAP } from '../constants';
import { ListingMapper } from '../listing.mapper';
import { LISTING_SUMMARY_SELECT } from '../listing.selects';

/** 최근 본 매물/단지/중개사무소. Exported so the complexes/agencies modules can record views. */
@Injectable()
export class RecentViewsService {
  private readonly logger = new Logger(RecentViewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: ListingMapper,
  ) {}

  /** Upserts the view and trims the user's history of that type to RECENT_VIEWS_CAP. Never throws. */
  async record(userId: string, targetType: RecentViewTarget, targetId: string): Promise<void> {
    try {
      const viewedAt = new Date();
      await this.prisma.recentView.upsert({
        where: { userId_targetType_targetId: { userId, targetType, targetId } },
        create: { userId, targetType, targetId, viewedAt },
        update: { viewedAt },
      });
      await this.prisma.$executeRaw`
        DELETE FROM recent_views rv
        USING (
          SELECT target_id FROM recent_views
          WHERE user_id = ${userId}::uuid AND target_type = ${targetType}::recent_view_target
          ORDER BY viewed_at DESC
          OFFSET ${RECENT_VIEWS_CAP}
        ) old
        WHERE rv.user_id = ${userId}::uuid
          AND rv.target_type = ${targetType}::recent_view_target
          AND rv.target_id = old.target_id`;
    } catch (err) {
      this.logger.warn({ err, targetType, targetId }, 'recent view record failed');
    }
  }

  async list(userId: string, q: RecentViewsQuery): Promise<Paginated<RecentViewItem>> {
    const where = { userId, targetType: q.targetType };
    const page = await paginate(
      q,
      (args) =>
        this.prisma.recentView.findMany({
          where,
          orderBy: { viewedAt: 'desc' },
          select: { targetType: true, targetId: true, viewedAt: true },
          ...args,
        }),
      () => this.prisma.recentView.count({ where }),
    );
    const ids = page.items.map((r) => r.targetId);
    const base = page.items.map(
      (r): RecentViewItem => ({
        targetType: r.targetType,
        targetId: r.targetId,
        viewedAt: r.viewedAt.toISOString(),
      }),
    );
    if (ids.length === 0) return { ...page, items: base };

    switch (q.targetType) {
      case RecentViewTarget.LISTING: {
        const rows = await this.prisma.listing.findMany({
          where: { id: { in: ids }, deletedAt: null, status: { in: [...PUBLIC_LISTING_STATUSES] } },
          select: LISTING_SUMMARY_SELECT,
        });
        const byId = new Map(rows.map((r) => [r.id, this.mapper.summary(r)]));
        return { ...page, items: base.map((b) => ({ ...b, listing: byId.get(b.targetId) })) };
      }
      case RecentViewTarget.COMPLEX: {
        const rows = await this.prisma.complex.findMany({
          where: { id: { in: ids }, deletedAt: null },
          select: { id: true, name: true, roadAddress: true },
        });
        const byId = new Map(rows.map((r) => [r.id, r]));
        return { ...page, items: base.map((b) => ({ ...b, complex: byId.get(b.targetId) })) };
      }
      case RecentViewTarget.AGENCY: {
        const rows = await this.prisma.agency.findMany({
          where: { id: { in: ids }, deletedAt: null },
          select: { id: true, name: true, roadAddress: true },
        });
        const byId = new Map(rows.map((r) => [r.id, r]));
        return { ...page, items: base.map((b) => ({ ...b, agency: byId.get(b.targetId) })) };
      }
    }
  }

  async clear(userId: string, targetType?: RecentViewTarget): Promise<number> {
    const { count } = await this.prisma.recentView.deleteMany({
      where: { userId, ...(targetType ? { targetType } : {}) },
    });
    return count;
  }
}
