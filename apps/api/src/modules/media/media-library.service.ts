import type { ReadStream } from 'node:fs';
import {
  AGENCY_ROLES,
  ErrorCode,
  MediaStatus,
  MediaVisibility,
  type AdminMediaListQuery,
  type AdminMediaView,
  type MediaView,
  type MyMediaListQuery,
  type OwnMediaView,
  type Paginated,
} from '@house/shared';
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { isUserPrincipal, type Principal, type UserPrincipal } from '../../common/auth/principal';
import { RequestContext } from '../../common/context/request-context';
import { AppException } from '../../common/errors/app.exception';
import { paginate } from '../../common/pagination/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaFiles } from './media-files';
import { MediaStorage } from './media-storage';
import { MediaMapper, referenceTotal } from './media.mapper';
import {
  attachedWhere,
  mediaViewSelect,
  unattachedWhere,
  type MediaViewRow,
} from './media.selects';

export interface MediaFileStream {
  stream: ReadStream;
  mimeType: string;
  sizeBytes: number;
  /** ASCII-only download name (never the user-supplied one). */
  filename: string;
}

const EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

const notFound = () => AppException.notFound(ErrorCode.MEDIA_NOT_FOUND);

/** Reading, listing, streaming and deleting uploads (user + admin side). */
@Injectable()
export class MediaLibraryService {
  private readonly logger = new Logger(MediaLibraryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorage,
    private readonly files: MediaFiles,
    private readonly mapper: MediaMapper,
  ) {}

  listMine(user: UserPrincipal, q: MyMediaListQuery): Promise<Paginated<OwnMediaView>> {
    const where: Prisma.MediaWhereInput = {
      ownerUserId: user.userId,
      deletedAt: null,
      ...(q.purpose ? { purpose: { in: q.purpose } } : {}),
      ...(q.status ? { status: { in: q.status } } : {}),
    };
    return this.page(q, where, (row) => this.mapper.toOwnView(row));
  }

  /** Owners see their uploads in any state; everyone else only READY public media. */
  async getForViewer(id: string, principal: Principal | undefined): Promise<MediaView> {
    const row = await this.prisma.media.findFirst({
      where: { id, deletedAt: null },
      select: mediaViewSelect,
    });
    if (!row) throw notFound();
    if (isUserPrincipal(principal) && row.ownerUserId === principal.userId) {
      return this.mapper.toOwnView(row);
    }
    if (row.visibility !== MediaVisibility.PUBLIC || row.status !== MediaStatus.READY) {
      throw notFound();
    }
    return this.mapper.toView(row);
  }

  /**
   * A private file for its uploader, or for staff (AGENT/AGENCY_OWNER) of the agency it is
   * attached to as a document. Anyone else gets 404.
   */
  async openPrivate(id: string, user: UserPrincipal): Promise<MediaFileStream> {
    const staffAgencyId = AGENCY_ROLES.includes(user.role) ? user.agencyId : null;
    const row = await this.prisma.media.findFirst({
      where: {
        id,
        deletedAt: null,
        visibility: MediaVisibility.PRIVATE,
        OR: [
          { ownerUserId: user.userId },
          ...(staffAgencyId ? [{ agencyDocuments: { some: { agencyId: staffAgencyId } } }] : []),
        ],
      },
      select: { id: true, status: true, storageKey: true, mimeType: true, visibility: true },
    });
    if (!row) throw notFound();
    return this.open(row);
  }

  // ---------- admin ----------

  listAll(q: AdminMediaListQuery): Promise<Paginated<AdminMediaView>> {
    const where: Prisma.MediaWhereInput = {
      ...(q.includeDeleted ? {} : { deletedAt: null }),
      ...(q.purpose ? { purpose: { in: q.purpose } } : {}),
      ...(q.status ? { status: { in: q.status } } : {}),
      ...(q.visibility ? { visibility: q.visibility } : {}),
      ...(q.ownerUserId ? { ownerUserId: q.ownerUserId } : {}),
      ...(q.ownerAdminId ? { ownerAdminId: q.ownerAdminId } : {}),
      ...(q.orphaned === true ? unattachedWhere : q.orphaned === false ? attachedWhere : {}),
    };
    return this.page(q, where, (row) => this.mapper.toAdminView(row));
  }

  async getForAdmin(id: string): Promise<AdminMediaView> {
    const row = await this.prisma.media.findUnique({ where: { id }, select: mediaViewSelect });
    if (!row) throw notFound();
    return this.mapper.toAdminView(row);
  }

  async openForAdmin(id: string): Promise<MediaFileStream> {
    const row = await this.prisma.media.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true, storageKey: true, mimeType: true, visibility: true },
    });
    if (!row) throw notFound();
    return this.open(row);
  }

  // ---------- delete ----------

  deleteMine(id: string, user: UserPrincipal): Promise<void> {
    return this.softDelete(id, user.userId);
  }

  async deleteAsAdmin(id: string): Promise<AdminMediaView> {
    const before = await this.getForAdmin(id);
    if (before.deletedAt) throw notFound();
    RequestContext.setAuditBefore(before);
    await this.softDelete(id, null);
    return { ...before, deletedAt: new Date().toISOString() };
  }

  /**
   * Soft-deletes an unattached upload and removes its files right away (the row is purged by the
   * cleanup job later). The row is locked FOR UPDATE so a concurrent attach (FOR SHARE) either
   * finishes first — and the delete is refused — or waits and then sees the row deleted.
   */
  private async softDelete(id: string, ownerUserId: string | null): Promise<void> {
    const row = await this.prisma.$transaction(async (tx) => {
      const locked = ownerUserId
        ? await tx.$queryRaw<{ id: string }[]>`
            SELECT id::text AS id FROM media
            WHERE id = ${id}::uuid AND owner_user_id = ${ownerUserId}::uuid AND deleted_at IS NULL
            FOR UPDATE`
        : await tx.$queryRaw<{ id: string }[]>`
            SELECT id::text AS id FROM media WHERE id = ${id}::uuid AND deleted_at IS NULL FOR UPDATE`;
      if (locked.length === 0) throw notFound();
      const current = await tx.media.findUniqueOrThrow({ where: { id }, select: mediaViewSelect });
      if (referenceTotal(current) > 0) throw AppException.conflict(ErrorCode.MEDIA_IN_USE);
      await tx.media.update({ where: { id }, data: { deletedAt: new Date() } });
      return current;
    });
    await this.files.removeAll(row).catch((err: unknown) => {
      // The purge phase of the cleanup job retries file removal.
      this.logger.error({ err, mediaId: id }, 'failed to remove media files');
    });
  }

  private async open(row: {
    id: string;
    status: string;
    storageKey: string;
    mimeType: string;
    visibility: MediaVisibility;
  }): Promise<MediaFileStream> {
    if (row.status !== MediaStatus.READY) throw AppException.conflict(ErrorCode.MEDIA_NOT_READY);
    const size = await this.storage.size(row.visibility, row.storageKey);
    if (size === null) {
      this.logger.error({ mediaId: row.id }, 'media file missing on disk');
      throw notFound();
    }
    return {
      stream: this.storage.open(row.visibility, row.storageKey),
      mimeType: row.mimeType,
      sizeBytes: size,
      filename: `media-${row.id}.${EXT[row.mimeType] ?? 'bin'}`,
    };
  }

  private page<T>(
    q: { page: number; pageSize: number },
    where: Prisma.MediaWhereInput,
    map: (row: MediaViewRow) => T,
  ): Promise<Paginated<T>> {
    return paginate(
      q,
      async (args) =>
        (
          await this.prisma.media.findMany({
            where,
            select: mediaViewSelect,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...args,
          })
        ).map(map),
      () => this.prisma.media.count({ where }),
    );
  }
}
