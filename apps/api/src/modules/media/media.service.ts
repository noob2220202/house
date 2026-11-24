import {
  ErrorCode,
  MediaStatus,
  mediaVisibilityFor,
  type ImageVariant,
  type MediaPurpose,
  type MediaView,
  type MediaVisibility,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService, type PrismaTx } from '../../prisma/prisma.service';
import { MediaFiles } from './media-files';
import { MediaStorage } from './media-storage';
import { MediaMapper } from './media.mapper';
import { mediaRefSelect, mediaViewSelect, unattachedWhere, type MediaRef } from './media.selects';

export interface MediaUsableRule {
  /** Accepted purpose(s); visibility follows from the purpose. */
  purpose: MediaPurpose | readonly MediaPurpose[];
  /** Only uploads of this user (omit for admin-curated purposes such as BANNER). */
  ownerUserId?: string;
  /** Only uploads not referenced anywhere yet (one-shot attachments: documents, deal-request photos). */
  unattached?: boolean;
  /**
   * Extra alternative accepted instead of `ownerUserId`, e.g. photos already attached to the same
   * listing: `{ listingPhotos: { some: { listingId } } }`.
   */
  orWhere?: Prisma.MediaWhereInput;
  /** Error thrown when any id is unusable (default MEDIA_INVALID, 400). */
  errorCode?: ErrorCode;
}

export interface MediaScrubResult {
  /** Uploads whose original file name was removed. */
  filenamesCleared: number;
  /** Unattached uploads soft-deleted (files go with the next cleanup purge). */
  deleted: number;
}

/** An upload `discard` soft-deleted, whose files `removeFiles` erases after commit. */
export interface DiscardedMedia {
  id: string;
  storageKey: string;
  visibility: MediaVisibility;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * What other modules use from the media domain. Attach/detach semantics:
 *  - attach = inside your transaction, `assertUsable(ids, rule, tx)` (locks the rows so they cannot
 *    be deleted concurrently), then create your FK row (ListingPhoto, Banner.pcMediaId…) with the
 *    SAME `tx`. A DB trigger also refuses any new reference to a soft-deleted row.
 *  - detach = delete/clear your FK row, then `released(ids, tx)` so the orphan grace period
 *    (MEDIA_ORPHAN_GRACE_HOURS) restarts; unreferenced uploads are collected by the cleanup job.
 * "Attached" is always derived from the FK relations, never from a flag that could drift.
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorage,
    private readonly mapper: MediaMapper,
    private readonly files: MediaFiles,
  ) {}

  /**
   * Throws (400) unless every id is a live, READY upload satisfying `rule`. Returns rows in input
   * order. With a transaction client the rows stay locked until it commits: FOR SHARE (blocks
   * deletes and cleanup), or FOR UPDATE for `unattached` rules so two transactions cannot both
   * claim the same one-shot upload. Locks are taken in id order (no deadlocks between attachers).
   */
  async assertUsable(
    mediaIds: readonly string[],
    rule: MediaUsableRule,
    db: PrismaTx = this.prisma,
  ): Promise<MediaRef[]> {
    const ids = [...new Set(mediaIds)];
    if (ids.length === 0) return [];
    const inTx = db !== this.prisma;
    if (rule.unattached && !inTx) {
      // An unlocked "not attached yet" check proves nothing by the time the FK row is written.
      throw new Error('MediaService.assertUsable: `unattached` requires a transaction client');
    }
    const fail = () => AppException.badRequest(rule.errorCode ?? ErrorCode.MEDIA_INVALID);
    if (!ids.every((id) => UUID.test(id))) throw fail();
    if (inTx) {
      const sorted = ids.map((id) => id.toLowerCase()).sort();
      if (rule.unattached) {
        await db.$queryRaw`
          SELECT id FROM media WHERE id = ANY(${sorted}::uuid[]) ORDER BY id FOR UPDATE`;
      } else {
        await db.$queryRaw`
          SELECT id FROM media WHERE id = ANY(${sorted}::uuid[]) ORDER BY id FOR SHARE`;
      }
    }
    const purposes: MediaPurpose[] =
      typeof rule.purpose === 'string' ? [rule.purpose] : [...rule.purpose];
    const visibilities = [...new Set(purposes.map(mediaVisibilityFor))];
    const owner: Prisma.MediaWhereInput[] = [];
    if (rule.ownerUserId) {
      owner.push(
        rule.orWhere
          ? { OR: [{ ownerUserId: rule.ownerUserId }, rule.orWhere] }
          : { ownerUserId: rule.ownerUserId },
      );
    } else if (rule.orWhere) {
      owner.push(rule.orWhere);
    }
    const rows = await db.media.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        status: MediaStatus.READY,
        purpose: { in: purposes },
        visibility: { in: visibilities },
        AND: [...owner, ...(rule.unattached ? [unattachedWhere] : [])],
      },
      select: mediaRefSelect,
    });
    if (rows.length !== ids.length) throw fail();
    const byId = new Map(rows.map((r) => [r.id.toLowerCase(), r]));
    return ids
      .map((id) => byId.get(id.toLowerCase()))
      .filter((r): r is MediaRef => r !== undefined);
  }

  /** Call after removing a reference: restarts the orphan grace period of those uploads. */
  async released(mediaIds: readonly string[], db: PrismaTx = this.prisma): Promise<void> {
    const ids = [...new Set(mediaIds)].filter((id) => UUID.test(id));
    if (ids.length === 0) return;
    await db.media.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { updatedAt: new Date() },
    });
  }

  /**
   * Member withdrawal (PII scrub job, inside its transaction): forgets the uploaded file names of
   * all of the user's uploads (often real names, e.g. `홍길동_등록증.pdf`) and soft-deletes every
   * upload that is not attached anywhere, so the cleanup purge removes the files within the grace
   * period. Attached uploads stay (they belong to listings/agencies now); they are removed when their owner detaches them, or
   * — for agency documents — by the agencies retention purge (`discard`).
   */
  async scrubOwner(
    userId: string,
    db: PrismaTx,
    now: Date = new Date(),
  ): Promise<MediaScrubResult> {
    if (!UUID.test(userId)) return { filenamesCleared: 0, deleted: 0 };
    // Same lock order as softDelete/cleanup (row locks), so a concurrent attach either commits
    // first (row stays: attached) or sees the row deleted afterwards (guard trigger refuses).
    await db.$queryRaw`
      SELECT id FROM media WHERE owner_user_id = ${userId}::uuid AND deleted_at IS NULL
      ORDER BY id FOR UPDATE`;
    const cleared = await db.media.updateMany({
      where: { ownerUserId: userId, originalFilename: { not: null } },
      data: { originalFilename: null },
    });
    const deleted = await db.media.updateMany({
      where: { ownerUserId: userId, deletedAt: null, ...unattachedWhere },
      data: { deletedAt: now },
    });
    return { filenamesCleared: cleared.count, deleted: deleted.count };
  }

  /**
   * Retention purge (inside the caller's transaction, after it deleted the rows that referenced
   * these uploads): soft-deletes those that are no longer attached anywhere and forgets their file
   * names. Returns what `removeFiles` needs to erase the files once the transaction committed; the
   * cleanup purge removes any file left behind (e.g. a failed unlink) after its grace period.
   */
  async discard(
    mediaIds: readonly string[],
    db: PrismaTx,
    now: Date = new Date(),
  ): Promise<DiscardedMedia[]> {
    const ids = [...new Set(mediaIds)].filter((id) => UUID.test(id));
    if (ids.length === 0) return [];
    const sorted = ids.map((id) => id.toLowerCase()).sort();
    await db.$queryRaw`
      SELECT id FROM media WHERE id = ANY(${sorted}::uuid[]) AND deleted_at IS NULL
      ORDER BY id FOR UPDATE`;
    const where: Prisma.MediaWhereInput = { id: { in: ids }, deletedAt: null, ...unattachedWhere };
    const rows = await db.media.findMany({
      where,
      select: { id: true, storageKey: true, visibility: true },
    });
    if (rows.length === 0) return [];
    await db.media.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { deletedAt: now, originalFilename: null },
    });
    return rows;
  }

  /** After the `discard` transaction committed: removes the files now (best effort). */
  async removeFiles(rows: readonly DiscardedMedia[]): Promise<void> {
    for (const row of rows) {
      await this.files.removeAll(row);
    }
  }

  /** Public URL of a variant (falls back to the full-size image). */
  url(ref: Pick<MediaRef, 'storageKey' | 'variants'>, variant: ImageVariant = 'large'): string {
    return this.mapper.url(ref, variant);
  }

  variantUrls(ref: Pick<MediaRef, 'storageKey' | 'variants'>): Record<ImageVariant, string> {
    return this.mapper.variantUrls(ref);
  }

  /** Public views of READY public media, in input order (unknown/private ids are skipped). */
  async views(mediaIds: readonly string[]): Promise<MediaView[]> {
    const ids = [...new Set(mediaIds)].filter((id) => UUID.test(id));
    if (ids.length === 0) return [];
    const rows = await this.prisma.media.findMany({
      where: { id: { in: ids }, deletedAt: null, status: MediaStatus.READY, visibility: 'PUBLIC' },
      select: mediaViewSelect,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [this.mapper.toView(row)] : [];
    });
  }

  /** Absolute path of a PRIVATE file, guaranteed inside PRIVATE_UPLOAD_DIR (null otherwise). */
  privateFilePath(storageKey: string): string | null {
    return this.storage.resolve('PRIVATE', storageKey);
  }
}
