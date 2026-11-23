import { ErrorCode, MediaPurpose } from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaTx } from '../../../prisma/prisma.service';
import { MediaService } from '../../media/media.service';

export interface ComplexMediaRef {
  storageKey: string;
  variants: Prisma.JsonValue | null;
}

export interface ComplexPhotoUrls {
  thumbUrl: string;
  mediumUrl: string;
  largeUrl: string;
}

/** What the complexes module needs from the media domain (attach/detach per MediaService). */
export interface ComplexMediaPort {
  /**
   * Inside the caller's transaction: locks the rows FOR SHARE and throws COMPLEX_MEDIA_INVALID
   * unless every id is a live, READY 단지 photo.
   */
  assertUsable(mediaIds: readonly string[], tx: PrismaTx): Promise<void>;
  /** After photo rows were removed: restarts the orphan grace period of those uploads. */
  released(mediaIds: readonly string[], tx: PrismaTx): Promise<void>;
  urls(media: ComplexMediaRef): ComplexPhotoUrls;
}

export const COMPLEX_MEDIA = Symbol('COMPLEX_MEDIA');

@Injectable()
export class MediaServiceComplexMedia implements ComplexMediaPort {
  constructor(private readonly media: MediaService) {}

  async assertUsable(mediaIds: readonly string[], tx: PrismaTx): Promise<void> {
    await this.media.assertUsable(
      mediaIds,
      { purpose: MediaPurpose.COMPLEX_PHOTO, errorCode: ErrorCode.COMPLEX_MEDIA_INVALID },
      tx,
    );
  }

  released(mediaIds: readonly string[], tx: PrismaTx): Promise<void> {
    return this.media.released(mediaIds, tx);
  }

  urls(media: ComplexMediaRef): ComplexPhotoUrls {
    const v = this.media.variantUrls(media);
    return { thumbUrl: v.thumb, mediumUrl: v.medium, largeUrl: v.large };
  }
}
