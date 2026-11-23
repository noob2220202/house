import { ErrorCode, MediaPurpose, type PhotoUrls } from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaTx } from '../../../prisma/prisma.service';
import { MediaService } from '../../media/media.service';

/** The media columns needed to build public URLs. */
export interface MediaRef {
  storageKey: string;
  variants: Prisma.JsonValue | null;
}

/** What the listings module needs from the media domain (attach/detach per MediaService). */
export interface ListingMediaPort {
  /**
   * Inside the transaction that writes the photo rows: locks the media rows and throws
   * LISTING_MEDIA_INVALID unless every id is a READY, PUBLIC listing photo that the user uploaded
   * or that is already attached to this listing (co-brokers may reorder those).
   */
  assertUsableForListing(
    mediaIds: readonly string[],
    ctx: { userId: string; listingId: string },
    tx: PrismaTx,
  ): Promise<void>;
  /** After photo rows were removed: restarts the orphan grace period of those uploads. */
  released(mediaIds: readonly string[], tx: PrismaTx): Promise<void>;
  urls(media: MediaRef): Pick<PhotoUrls, 'thumbUrl' | 'mediumUrl' | 'largeUrl'>;
}

export const LISTING_MEDIA = Symbol('LISTING_MEDIA');

@Injectable()
export class MediaServiceListingMedia implements ListingMediaPort {
  constructor(private readonly media: MediaService) {}

  async assertUsableForListing(
    mediaIds: readonly string[],
    ctx: { userId: string; listingId: string },
    tx: PrismaTx,
  ): Promise<void> {
    await this.media.assertUsable(
      mediaIds,
      {
        purpose: MediaPurpose.LISTING_PHOTO,
        ownerUserId: ctx.userId,
        orWhere: { listingPhotos: { some: { listingId: ctx.listingId } } },
        errorCode: ErrorCode.LISTING_MEDIA_INVALID,
      },
      tx,
    );
  }

  released(mediaIds: readonly string[], tx: PrismaTx): Promise<void> {
    return this.media.released(mediaIds, tx);
  }

  urls(media: MediaRef): Pick<PhotoUrls, 'thumbUrl' | 'mediumUrl' | 'largeUrl'> {
    const v = this.media.variantUrls(media);
    return { thumbUrl: v.thumb, mediumUrl: v.medium, largeUrl: v.large };
  }
}
