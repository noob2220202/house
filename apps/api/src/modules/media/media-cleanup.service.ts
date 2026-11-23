import {
  ERROR_MESSAGES,
  ErrorCode,
  MEDIA_ORPHAN_GRACE_HOURS,
  MediaStatus,
  type MediaCleanupResult,
} from '@house/shared';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CLEANUP_BATCH_SIZE } from './constants';
import { MediaFiles } from './media-files';
import { attachedWhere, orphanWhere, unattachedWhere } from './media.selects';

/**
 * Orphan cleanup (idempotent, safe to run concurrently):
 *  1. PENDING uploads older than the grace period (lost jobs) → FAILED.
 *  2. Unattached uploads whose last attach/detach is older than the grace period → soft-deleted.
 *  3. Soft-deleted rows older than the grace period → files removed, row purged.
 * Rows are locked (FOR UPDATE SKIP LOCKED) and the orphan condition re-checked under the lock, so
 * an upload being attached concurrently (MediaService.assertUsable and the reference guard trigger
 * hold FOR SHARE) is never taken; an attach that comes after the soft-delete is refused by the
 * trigger. Soft-deleted rows that are still referenced (should not exist) are never purged and are
 * reported in the log.
 */
@Injectable()
export class MediaCleanupService {
  private readonly logger = new Logger(MediaCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly files: MediaFiles,
  ) {}

  async run(now: Date = new Date()): Promise<MediaCleanupResult> {
    const cutoff = new Date(now.getTime() - MEDIA_ORPHAN_GRACE_HOURS * 3_600_000);

    const stale = await this.prisma.media.updateMany({
      where: { status: MediaStatus.PENDING, deletedAt: null, createdAt: { lt: cutoff } },
      data: {
        status: MediaStatus.FAILED,
        error: ERROR_MESSAGES[ErrorCode.MEDIA_PROCESSING_FAILED],
      },
    });

    const candidates = await this.prisma.media.findMany({
      where: orphanWhere(cutoff),
      select: { id: true },
      orderBy: { updatedAt: 'asc' },
      take: CLEANUP_BATCH_SIZE,
    });
    let orphaned = 0;
    if (candidates.length > 0) {
      orphaned = await this.prisma.$transaction(async (tx) => {
        const ids = candidates.map((c) => c.id);
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT id::text AS id FROM media WHERE id = ANY(${ids}::uuid[]) FOR UPDATE SKIP LOCKED`;
        if (locked.length === 0) return 0;
        const res = await tx.media.updateMany({
          where: { id: { in: locked.map((l) => l.id) }, ...orphanWhere(cutoff) },
          data: { deletedAt: now },
        });
        return res.count;
      });
    }

    const purged = await this.purge(cutoff);
    await this.reportDeletedButReferenced();
    const result = { orphaned, staleFailed: stale.count, purged };
    if (orphaned + stale.count + purged > 0) this.logger.log(result, 'media cleanup');
    return result;
  }

  private async reportDeletedButReferenced(): Promise<void> {
    const rows = await this.prisma.media.findMany({
      where: { deletedAt: { not: null }, ...attachedWhere },
      select: { id: true },
      take: 20,
    });
    if (rows.length > 0) {
      this.logger.warn(
        { mediaIds: rows.map((r) => r.id) },
        'soft-deleted media is still referenced; kept (needs manual repair)',
      );
    }
  }

  private async purge(cutoff: Date): Promise<number> {
    const rows = await this.prisma.media.findMany({
      where: { deletedAt: { lt: cutoff }, ...unattachedWhere },
      select: { id: true, storageKey: true, visibility: true },
      orderBy: { deletedAt: 'asc' },
      take: CLEANUP_BATCH_SIZE,
    });
    let purged = 0;
    for (const row of rows) {
      await this.files.removeAll(row);
      try {
        const res = await this.prisma.media.deleteMany({
          where: { id: row.id, deletedAt: { not: null }, ...unattachedWhere },
        });
        purged += res.count;
      } catch (err) {
        // A reference appeared in between (FK Restrict): keep the row, it is in use again.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') continue;
        throw err;
      }
    }
    return purged;
  }
}
