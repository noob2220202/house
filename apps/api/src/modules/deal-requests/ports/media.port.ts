import { ErrorCode, MediaPurpose, type ImageVariant } from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { MediaService } from '../../media/media.service';

export interface DealRequestMediaRef {
  storageKey: string;
  variants: Prisma.JsonValue | null;
}

/**
 * What the deal-requests module needs from the media domain (attach/detach per MediaService).
 */
export interface DealRequestMediaPort {
  /**
   * Throws DEAL_REQUEST_PHOTO_INVALID unless every id is a READY, PUBLIC deal-request photo uploaded
   * by `userId` that is not attached to a request yet.
   */
  assertPhotosUsable(mediaIds: readonly string[], userId: string, db?: PrismaTx): Promise<void>;
  publicUrl(media: DealRequestMediaRef, variant?: ImageVariant): string;
  /**
   * Detaches every photo of the given requests and soft-deletes their media, so the media cleanup
   * job removes the files (member withdrawal). Returns the number of photos detached.
   */
  discardPhotos(dealRequestIds: readonly string[], now: Date, db: PrismaTx): Promise<number>;
}

export const DEAL_REQUEST_MEDIA = Symbol('DEAL_REQUEST_MEDIA');

@Injectable()
export class MediaServiceDealRequestMedia implements DealRequestMediaPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async assertPhotosUsable(
    mediaIds: readonly string[],
    userId: string,
    db?: PrismaTx,
  ): Promise<void> {
    if (mediaIds.length === 0) return;
    const check = (tx: PrismaTx) =>
      this.media.assertUsable(
        mediaIds,
        {
          purpose: MediaPurpose.DEAL_REQUEST_PHOTO,
          ownerUserId: userId,
          unattached: true,
          errorCode: ErrorCode.DEAL_REQUEST_PHOTO_INVALID,
        },
        tx,
      );
    // Without a caller transaction this is only a pre-check (the locked check runs again later).
    if (db) await check(db);
    else await this.prisma.$transaction(check);
  }

  async discardPhotos(dealRequestIds: readonly string[], now: Date, db: PrismaTx): Promise<number> {
    if (dealRequestIds.length === 0) return 0;
    const photos = await db.dealRequestPhoto.findMany({
      where: { dealRequestId: { in: [...dealRequestIds] } },
      select: { mediaId: true },
    });
    if (photos.length === 0) return 0;
    const mediaIds = photos.map((p) => p.mediaId);
    await db.dealRequestPhoto.deleteMany({ where: { dealRequestId: { in: [...dealRequestIds] } } });
    await db.media.updateMany({
      where: { id: { in: mediaIds }, deletedAt: null },
      data: { deletedAt: now },
    });
    return photos.length;
  }

  publicUrl(media: DealRequestMediaRef, variant: ImageVariant = 'medium'): string {
    return this.media.url(media, variant);
  }
}
