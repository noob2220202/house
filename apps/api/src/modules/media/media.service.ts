import {
  ErrorCode,
  MediaStatus,
  mediaVisibilityFor,
  type ImageVariant,
  type MediaPurpose,
  type MediaView,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService, type PrismaTx } from '../../prisma/prisma.service';
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * What other modules use from the media domain. Attach/detach semantics:
 *  - attach = inside your transaction, `assertUsable(ids, rule, tx)` (locks the rows FOR SHARE so
 *    they cannot be deleted concurrently), then create your FK row (ListingPhoto, Banner.pcMediaId…).
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
  ) {}

  /** Throws (400) unless every id is a live, READY upload satisfying `rule`. Returns rows in input order. */
  async assertUsable(
    mediaIds: readonly string[],
    rule: MediaUsableRule,
    db: PrismaTx = this.prisma,
  ): Promise<MediaRef[]> {
    const ids = [...new Set(mediaIds)];
    if (ids.length === 0) return [];
    const fail = () => AppException.badRequest(rule.errorCode ?? ErrorCode.MEDIA_INVALID);
    if (!ids.every((id) => UUID.test(id))) throw fail();
    if (db !== this.prisma) {
      await db.$queryRaw`SELECT id FROM media WHERE id = ANY(${ids}::uuid[]) FOR SHARE`;
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
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((r): r is MediaRef => r !== undefined);
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
