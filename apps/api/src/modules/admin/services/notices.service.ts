import {
  type AdminNoticeView,
  ErrorCode,
  type NoticeAdminListQuery,
  type NoticeInput,
  type NoticeListItem,
  type NoticeUpdateInput,
  type NoticeView,
  type Paginated,
  type PaginationQuery,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Notice, Prisma } from '@prisma/client';
import { CacheService } from '../../../common/cache/cache.service';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { RequestContext } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { toAdminNoticeView, toNoticeListItem, toNoticeView } from '../admin.mapper';
import { ADMIN_CACHE, CONTENT_CACHE_TTL_SECONDS } from '../constants';

const PUBLISHED: Prisma.NoticeWhereInput = { isPublished: true, deletedAt: null };
const PUBLIC_ORDER: Prisma.NoticeOrderByWithRelationInput[] = [
  { isPinned: 'desc' },
  { publishedAt: 'desc' },
  { id: 'desc' },
];

/** 공지사항: public list/detail (published only) and back-office CRUD (soft delete). */
@Injectable()
export class NoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async publicList(q: PaginationQuery): Promise<Paginated<NoticeListItem>> {
    const v = await this.cache.version(ADMIN_CACHE.CONTENT);
    return this.cache.getOrSet(
      `cache:admin:notices:v${v}:${q.page}:${q.pageSize}`,
      CONTENT_CACHE_TTL_SECONDS,
      async () => {
        const page = await paginate(
          q,
          (args) =>
            this.prisma.notice.findMany({ where: PUBLISHED, orderBy: PUBLIC_ORDER, ...args }),
          () => this.prisma.notice.count({ where: PUBLISHED }),
        );
        return { ...page, items: page.items.map(toNoticeListItem) };
      },
    );
  }

  /** Published notice; `countView` is false for bots so crawlers don't inflate the counter. */
  async publicDetail(id: string, countView: boolean): Promise<NoticeView> {
    const row = await this.prisma.notice.findFirst({ where: { id, ...PUBLISHED } });
    if (!row) throw AppException.notFound(ErrorCode.NOTICE_NOT_FOUND);
    if (!countView) return toNoticeView(row);
    const updated = await this.prisma.notice.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
    return toNoticeView(updated);
  }

  async adminList(q: NoticeAdminListQuery): Promise<Paginated<AdminNoticeView>> {
    const where: Prisma.NoticeWhereInput = {
      deletedAt: null,
      ...(q.isPublished !== undefined ? { isPublished: q.isPublished } : {}),
      ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const page = await paginate(
      q,
      (args) =>
        this.prisma.notice.findMany({
          where,
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
      () => this.prisma.notice.count({ where }),
    );
    return { ...page, items: page.items.map(toAdminNoticeView) };
  }

  async adminDetail(id: string): Promise<AdminNoticeView> {
    return toAdminNoticeView(await this.load(id));
  }

  async create(dto: NoticeInput, admin: AdminPrincipal): Promise<AdminNoticeView> {
    const row = await this.prisma.notice.create({
      data: {
        ...dto,
        publishedAt: dto.isPublished ? new Date() : null,
        createdByAdminId: admin.adminId,
      },
    });
    await this.cache.bump(ADMIN_CACHE.CONTENT);
    return toAdminNoticeView(row);
  }

  async update(id: string, dto: NoticeUpdateInput): Promise<AdminNoticeView> {
    const before = await this.load(id);
    RequestContext.setAuditBefore(toAdminNoticeView(before));
    const row = await this.prisma.notice.update({
      where: { id },
      data: {
        ...dto,
        // First publication stamps publishedAt; re-publishing keeps the original date.
        ...(dto.isPublished && !before.publishedAt ? { publishedAt: new Date() } : {}),
      },
    });
    await this.cache.bump(ADMIN_CACHE.CONTENT);
    return toAdminNoticeView(row);
  }

  async remove(id: string): Promise<void> {
    const before = await this.load(id);
    RequestContext.setAuditBefore(toAdminNoticeView(before));
    await this.prisma.notice.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.cache.bump(ADMIN_CACHE.CONTENT);
  }

  private async load(id: string): Promise<Notice> {
    const row = await this.prisma.notice.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw AppException.notFound(ErrorCode.NOTICE_NOT_FOUND);
    return row;
  }
}
