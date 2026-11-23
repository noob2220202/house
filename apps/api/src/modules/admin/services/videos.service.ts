import {
  type AdminLocalVideoView,
  ErrorCode,
  type LocalVideoAdminListQuery,
  type LocalVideoInput,
  type LocalVideoListQuery,
  type LocalVideoUpdateInput,
  type LocalVideoView,
  type Paginated,
  parseYoutubeVideoId,
  youtubeThumbnailUrl,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { LocalVideo, Prisma } from '@prisma/client';
import { CacheService } from '../../../common/cache/cache.service';
import { RequestContext } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { toAdminLocalVideoView, toLocalVideoView } from '../admin.mapper';
import { ADMIN_CACHE, CONTENT_CACHE_TTL_SECONDS } from '../constants';

const ORDER: Prisma.LocalVideoOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { publishedAt: 'desc' },
  { id: 'desc' },
];

/** YouTube URL → { youtubeVideoId, thumbnailUrl } (schema already checked the shape). */
function youtubeFields(url: string): { youtubeVideoId: string; thumbnailUrl: string | null } {
  const id = parseYoutubeVideoId(url);
  if (!id) throw AppException.badRequest(ErrorCode.VIDEO_URL_INVALID);
  return { youtubeVideoId: id, thumbnailUrl: youtubeThumbnailUrl(url) };
}

/** 지역 영상 (YouTube): public list (published only, cached) and back-office CRUD. */
@Injectable()
export class VideosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async publicList(q: LocalVideoListQuery): Promise<Paginated<LocalVideoView>> {
    const where: Prisma.LocalVideoWhereInput = {
      isPublished: true,
      deletedAt: null,
      ...(q.regionCode ? { regionCode: q.regionCode } : {}),
      ...(q.complexId ? { complexId: q.complexId } : {}),
    };
    const v = await this.cache.version(ADMIN_CACHE.CONTENT);
    return this.cache.getOrSet(
      `cache:admin:videos:v${v}:${q.regionCode ?? '-'}:${q.complexId ?? '-'}:${q.page}:${q.pageSize}`,
      CONTENT_CACHE_TTL_SECONDS,
      async () => {
        const page = await paginate(
          q,
          (args) => this.prisma.localVideo.findMany({ where, orderBy: ORDER, ...args }),
          () => this.prisma.localVideo.count({ where }),
        );
        return { ...page, items: page.items.map(toLocalVideoView) };
      },
    );
  }

  async adminList(q: LocalVideoAdminListQuery): Promise<Paginated<AdminLocalVideoView>> {
    const where: Prisma.LocalVideoWhereInput = {
      deletedAt: null,
      ...(q.regionCode ? { regionCode: q.regionCode } : {}),
      ...(q.complexId ? { complexId: q.complexId } : {}),
      ...(q.isPublished !== undefined ? { isPublished: q.isPublished } : {}),
      ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const page = await paginate(
      q,
      (args) => this.prisma.localVideo.findMany({ where, orderBy: ORDER, ...args }),
      () => this.prisma.localVideo.count({ where }),
    );
    return { ...page, items: page.items.map(toAdminLocalVideoView) };
  }

  async adminDetail(id: string): Promise<AdminLocalVideoView> {
    return toAdminLocalVideoView(await this.load(id));
  }

  async create(dto: LocalVideoInput): Promise<AdminLocalVideoView> {
    if (dto.complexId) await this.assertComplex(dto.complexId);
    const row = await this.prisma.localVideo.create({
      data: {
        title: dto.title,
        youtubeUrl: dto.youtubeUrl,
        ...youtubeFields(dto.youtubeUrl),
        description: dto.description ?? null,
        regionCode: dto.regionCode ?? null,
        complexId: dto.complexId ?? null,
        sortOrder: dto.sortOrder,
        isPublished: dto.isPublished,
        publishedAt: dto.isPublished ? new Date() : null,
      },
    });
    await this.cache.bump(ADMIN_CACHE.CONTENT);
    return toAdminLocalVideoView(row);
  }

  async update(id: string, dto: LocalVideoUpdateInput): Promise<AdminLocalVideoView> {
    const before = await this.load(id);
    if (dto.complexId) await this.assertComplex(dto.complexId);
    RequestContext.setAuditBefore(toAdminLocalVideoView(before));
    const row = await this.prisma.localVideo.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.youtubeUrl !== undefined ? youtubeFields(dto.youtubeUrl) : {}),
        ...(dto.isPublished && !before.publishedAt ? { publishedAt: new Date() } : {}),
      },
    });
    await this.cache.bump(ADMIN_CACHE.CONTENT);
    return toAdminLocalVideoView(row);
  }

  async remove(id: string): Promise<void> {
    const before = await this.load(id);
    RequestContext.setAuditBefore(toAdminLocalVideoView(before));
    await this.prisma.localVideo.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.cache.bump(ADMIN_CACHE.CONTENT);
  }

  private async assertComplex(complexId: string): Promise<void> {
    const found = await this.prisma.complex.findFirst({
      where: { id: complexId, deletedAt: null },
      select: { id: true },
    });
    if (!found) throw AppException.badRequest(ErrorCode.VIDEO_COMPLEX_NOT_FOUND);
  }

  private async load(id: string): Promise<LocalVideo> {
    const row = await this.prisma.localVideo.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw AppException.notFound(ErrorCode.VIDEO_NOT_FOUND);
    return row;
  }
}
