import { ErrorCode, MediaPurpose, type AdMediaView, type ImageVariant } from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaTx } from '../../../prisma/prisma.service';
import { MediaService } from '../../media/media.service';

/** Media columns needed to build public URLs. */
export const adMediaSelect = {
  id: true,
  storageKey: true,
  variants: true,
  width: true,
  height: true,
} satisfies Prisma.MediaSelect;
export type AdMediaRef = Prisma.MediaGetPayload<{ select: typeof adMediaSelect }>;

export type AdMediaPurpose = typeof MediaPurpose.BANNER | typeof MediaPurpose.POPUP;

/**
 * What the ads module needs from the media domain, following MediaService's attach/detach
 * contract: `assertUsable` inside the write transaction (locks the rows FOR SHARE until commit),
 * `released` after a reference is dropped or replaced.
 */
export interface AdsMediaPort {
  /** Throws BANNER_MEDIA_INVALID / POPUP_MEDIA_INVALID unless every id is a READY image of that purpose. */
  assertUsable(mediaIds: readonly string[], purpose: AdMediaPurpose, tx: PrismaTx): Promise<void>;
  /** Restarts the orphan grace period of uploads no longer referenced by this row. */
  released(mediaIds: readonly string[], tx: PrismaTx): Promise<void>;
  /** Public URL of the large variant (falls back to the original). */
  url(media: AdMediaRef, variant?: ImageVariant): string;
  view(media: AdMediaRef): AdMediaView;
}

export const ADS_MEDIA = Symbol('ADS_MEDIA');

@Injectable()
export class MediaServiceAdsMedia implements AdsMediaPort {
  constructor(private readonly media: MediaService) {}

  async assertUsable(
    mediaIds: readonly string[],
    purpose: AdMediaPurpose,
    tx: PrismaTx,
  ): Promise<void> {
    await this.media.assertUsable(
      mediaIds,
      {
        purpose,
        errorCode:
          purpose === MediaPurpose.BANNER
            ? ErrorCode.BANNER_MEDIA_INVALID
            : ErrorCode.POPUP_MEDIA_INVALID,
      },
      tx,
    );
  }

  released(mediaIds: readonly string[], tx: PrismaTx): Promise<void> {
    return this.media.released(mediaIds, tx);
  }

  url(media: AdMediaRef, variant: ImageVariant = 'large'): string {
    return this.media.url(media, variant);
  }

  view(media: AdMediaRef): AdMediaView {
    return { id: media.id, url: this.url(media), width: media.width, height: media.height };
  }
}
