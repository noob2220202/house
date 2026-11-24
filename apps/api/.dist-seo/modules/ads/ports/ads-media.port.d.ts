import { MediaPurpose, type AdMediaView, type ImageVariant } from '@house/shared';
import type { Prisma } from '@prisma/client';
import type { PrismaTx } from '../../../prisma/prisma.service';
import { MediaService } from '../../media/media.service';
/** Media columns needed to build public URLs. */
export declare const adMediaSelect: {
    id: true;
    storageKey: true;
    variants: true;
    width: true;
    height: true;
};
export type AdMediaRef = Prisma.MediaGetPayload<{
    select: typeof adMediaSelect;
}>;
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
export declare const ADS_MEDIA: unique symbol;
export declare class MediaServiceAdsMedia implements AdsMediaPort {
    private readonly media;
    constructor(media: MediaService);
    assertUsable(mediaIds: readonly string[], purpose: AdMediaPurpose, tx: PrismaTx): Promise<void>;
    released(mediaIds: readonly string[], tx: PrismaTx): Promise<void>;
    url(media: AdMediaRef, variant?: ImageVariant): string;
    view(media: AdMediaRef): AdMediaView;
}
