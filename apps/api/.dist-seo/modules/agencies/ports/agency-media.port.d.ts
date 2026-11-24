import { type ImageVariant } from '@house/shared';
import type { Prisma } from '@prisma/client';
import type { PrismaTx } from '../../../prisma/prisma.service';
import { MediaService } from '../../media/media.service';
export interface MediaRef {
    storageKey: string;
    variants: Prisma.JsonValue | null;
}
/** What the agencies module needs from the media domain (attach/detach per MediaService). */
export interface AgencyMediaPort {
    /**
     * Inside the transaction that creates the document rows: locks the uploads and throws
     * AGENCY_DOCUMENT_INVALID unless every id is a READY, PRIVATE agency-document upload of `userId`
     * that is not attached anywhere yet.
     */
    assertDocumentsUsable(mediaIds: readonly string[], userId: string, tx: PrismaTx): Promise<void>;
    /**
     * Inside the transaction that sets the logo: throws AGENCY_LOGO_INVALID unless the media is a
     * READY, PUBLIC agency logo of `userId`.
     */
    assertLogoUsable(mediaId: string, userId: string, tx: PrismaTx): Promise<void>;
    /**
     * Same for the cover: a READY, PUBLIC upload of `userId` with purpose AGENCY_COVER (or
     * AGENCY_LOGO, which the console used for covers before AGENCY_COVER existed — same public
     * image presets), else AGENCY_COVER_INVALID.
     */
    assertCoverUsable(mediaId: string, userId: string, tx: PrismaTx): Promise<void>;
    /** After a document row / logo reference was removed: restarts the orphan grace period. */
    released(mediaIds: readonly string[], tx: PrismaTx): Promise<void>;
    /** Public URL of a variant (falls back to the original). */
    publicUrl(media: MediaRef, variant?: ImageVariant): string;
    /** Absolute path of a PRIVATE file, guaranteed to stay inside PRIVATE_UPLOAD_DIR (null if not). */
    privateFilePath(storageKey: string): string | null;
}
export declare const AGENCY_MEDIA: unique symbol;
export declare class MediaServiceAgencyMedia implements AgencyMediaPort {
    private readonly media;
    constructor(media: MediaService);
    assertDocumentsUsable(mediaIds: readonly string[], userId: string, tx: PrismaTx): Promise<void>;
    assertLogoUsable(mediaId: string, userId: string, tx: PrismaTx): Promise<void>;
    assertCoverUsable(mediaId: string, userId: string, tx: PrismaTx): Promise<void>;
    released(mediaIds: readonly string[], tx: PrismaTx): Promise<void>;
    publicUrl(media: MediaRef, variant?: ImageVariant): string;
    privateFilePath(storageKey: string): string | null;
}
