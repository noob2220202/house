import {
  type AdminFaqView,
  ErrorCode,
  type FaqAdminListQuery,
  type FaqInput,
  type FaqListQuery,
  type FaqOrderInput,
  type FaqUpdateInput,
  type FaqView,
  type Paginated,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Faq, Prisma } from '@prisma/client';
import { CacheService } from '../../../common/cache/cache.service';
import { RequestContext } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { toAdminFaqView, toFaqView } from '../admin.mapper';
import { ADMIN_CACHE, CONTENT_CACHE_TTL_SECONDS } from '../constants';

const ORDER: Prisma.FaqOrderByWithRelationInput[] = [
  { category: 'asc' },
  { sortOrder: 'asc' },
  { id: 'asc' },
];

function searchWhere(q: string | undefined): Prisma.FaqWhereInput {
  if (!q) return {};
  return {
    OR: [
      { question: { contains: q, mode: 'insensitive' } },
      { answer: { contains: q, mode: 'insensitive' } },
    ],
  };
}

/** FAQ: public list (published only, cached) and back-office CRUD + ordering. */
@Injectable()
export class FaqsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async publicList(q: FaqListQuery): Promise<Paginated<FaqView>> {
    const where: Prisma.FaqWhereInput = {
      isPublished: true,
      deletedAt: null,
      ...(q.category ? { category: q.category } : {}),
      ...searchWhere(q.q),
    };
    const compute = async (): Promise<Paginated<FaqView>> => {
      const page = await paginate(
        q,
        (args) => this.prisma.faq.findMany({ where, orderBy: ORDER, ...args }),
        () => this.prisma.faq.count({ where }),
      );
      return { ...page, items: page.items.map(toFaqView) };
    };
    // Free-text searches are not cached (unbounded key space).
    if (q.q) return compute();
    const v = await this.cache.version(ADMIN_CACHE.CONTENT);
    return this.cache.getOrSet(
      `cache:admin:faqs:v${v}:${q.category ?? 'all'}:${q.page}:${q.pageSize}`,
      CONTENT_CACHE_TTL_SECONDS,
      compute,
    );
  }

  async adminList(q: FaqAdminListQuery): Promise<Paginated<AdminFaqView>> {
    const where: Prisma.FaqWhereInput = {
      deletedAt: null,
      ...(q.category ? { category: q.category } : {}),
      ...(q.isPublished !== undefined ? { isPublished: q.isPublished } : {}),
      ...searchWhere(q.q),
    };
    const page = await paginate(
      q,
      (args) => this.prisma.faq.findMany({ where, orderBy: ORDER, ...args }),
      () => this.prisma.faq.count({ where }),
    );
    return { ...page, items: page.items.map(toAdminFaqView) };
  }

  async adminDetail(id: string): Promise<AdminFaqView> {
    return toAdminFaqView(await this.load(id));
  }

  async create(dto: FaqInput): Promise<AdminFaqView> {
    const sortOrder =
      dto.sortOrder ??
      ((
        await this.prisma.faq.aggregate({
          where: { category: dto.category, deletedAt: null },
          _max: { sortOrder: true },
        })
      )._max.sortOrder ?? -1) + 1;
    const row = await this.prisma.faq.create({ data: { ...dto, sortOrder } });
    await this.cache.bump(ADMIN_CACHE.CONTENT);
    return toAdminFaqView(row);
  }

  async update(id: string, dto: FaqUpdateInput): Promise<AdminFaqView> {
    const before = await this.load(id);
    RequestContext.setAuditBefore(toAdminFaqView(before));
    const row = await this.prisma.faq.update({ where: { id }, data: dto });
    await this.cache.bump(ADMIN_CACHE.CONTENT);
    return toAdminFaqView(row);
  }

  async remove(id: string): Promise<void> {
    const before = await this.load(id);
    RequestContext.setAuditBefore(toAdminFaqView(before));
    await this.prisma.faq.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.cache.bump(ADMIN_CACHE.CONTENT);
  }

  /** sortOrder := position in `ids`. Every id must be a live FAQ. */
  async reorder(dto: FaqOrderInput): Promise<{ ids: string[] }> {
    await this.prisma.$transaction(async (tx) => {
      const found = await tx.faq.findMany({
        where: { id: { in: dto.ids }, deletedAt: null },
        select: { id: true, sortOrder: true },
      });
      if (found.length !== dto.ids.length) {
        const known = new Set(found.map((f) => f.id));
        throw AppException.badRequest(ErrorCode.FAQ_ORDER_INVALID, {
          unknownIds: dto.ids.filter((id) => !known.has(id)),
        });
      }
      RequestContext.setAuditBefore(found);
      await tx.$executeRaw`
        UPDATE faqs AS f SET sort_order = (o.ord - 1)::int, updated_at = now()
        FROM unnest(${dto.ids}::uuid[]) WITH ORDINALITY AS o(id, ord)
        WHERE f.id = o.id`;
    });
    await this.cache.bump(ADMIN_CACHE.CONTENT);
    return { ids: dto.ids };
  }

  private async load(id: string): Promise<Faq> {
    const row = await this.prisma.faq.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw AppException.notFound(ErrorCode.FAQ_NOT_FOUND);
    return row;
  }
}
