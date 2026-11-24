import { type ImageVariant } from '@house/shared';
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
export declare const DEAL_REQUEST_MEDIA: unique symbol;
export declare class MediaServiceDealRequestMedia implements DealRequestMediaPort {
    private readonly prisma;
    private readonly media;
    constructor(prisma: PrismaService, media: MediaService);
    assertPhotosUsable(mediaIds: readonly string[], userId: string, db?: PrismaTx): Promise<void>;
    discardPhotos(dealRequestIds: readonly string[], now: Date, db: PrismaTx): Promise<number>;
    publicUrl(media: DealRequestMediaRef, variant?: ImageVariant): string;
}
