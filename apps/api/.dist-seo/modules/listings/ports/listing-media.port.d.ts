import { type PhotoUrls } from '@house/shared';
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
    assertUsableForListing(mediaIds: readonly string[], ctx: {
        userId: string;
        listingId: string;
    }, tx: PrismaTx): Promise<void>;
    /** After photo rows were removed: restarts the orphan grace period of those uploads. */
    released(mediaIds: readonly string[], tx: PrismaTx): Promise<void>;
    urls(media: MediaRef): Pick<PhotoUrls, 'thumbUrl' | 'mediumUrl' | 'largeUrl'>;
}
export declare const LISTING_MEDIA: unique symbol;
export declare class MediaServiceListingMedia implements ListingMediaPort {
    private readonly media;
    constructor(media: MediaService);
    assertUsableForListing(mediaIds: readonly string[], ctx: {
        userId: string;
        listingId: string;
    }, tx: PrismaTx): Promise<void>;
    released(mediaIds: readonly string[], tx: PrismaTx): Promise<void>;
    urls(media: MediaRef): Pick<PhotoUrls, 'thumbUrl' | 'mediumUrl' | 'largeUrl'>;
}
