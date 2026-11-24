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
export declare const COMPLEX_MEDIA: unique symbol;
export declare class MediaServiceComplexMedia implements ComplexMediaPort {
    private readonly media;
    constructor(media: MediaService);
    assertUsable(mediaIds: readonly string[], tx: PrismaTx): Promise<void>;
    released(mediaIds: readonly string[], tx: PrismaTx): Promise<void>;
    urls(media: ComplexMediaRef): ComplexPhotoUrls;
}
