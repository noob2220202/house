import { ErrorCode, MediaPurpose, type ImageVariant } from '@house/shared';
import { Injectable } from '@nestjs/common';
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
  /** After a document row / logo reference was removed: restarts the orphan grace period. */
  released(mediaIds: readonly string[], tx: PrismaTx): Promise<void>;
  /** Public URL of a variant (falls back to the original). */
  publicUrl(media: MediaRef, variant?: ImageVariant): string;
  /** Absolute path of a PRIVATE file, guaranteed to stay inside PRIVATE_UPLOAD_DIR (null if not). */
  privateFilePath(storageKey: string): string | null;
}

export const AGENCY_MEDIA = Symbol('AGENCY_MEDIA');

@Injectable()
export class MediaServiceAgencyMedia implements AgencyMediaPort {
  constructor(private readonly media: MediaService) {}

  async assertDocumentsUsable(
    mediaIds: readonly string[],
    userId: string,
    tx: PrismaTx,
  ): Promise<void> {
    await this.media.assertUsable(
      mediaIds,
      {
        purpose: MediaPurpose.AGENCY_DOCUMENT,
        ownerUserId: userId,
        unattached: true,
        errorCode: ErrorCode.AGENCY_DOCUMENT_INVALID,
      },
      tx,
    );
  }

  async assertLogoUsable(mediaId: string, userId: string, tx: PrismaTx): Promise<void> {
    await this.media.assertUsable(
      [mediaId],
      {
        purpose: MediaPurpose.AGENCY_LOGO,
        ownerUserId: userId,
        errorCode: ErrorCode.AGENCY_LOGO_INVALID,
      },
      tx,
    );
  }

  released(mediaIds: readonly string[], tx: PrismaTx): Promise<void> {
    return this.media.released(mediaIds, tx);
  }

  publicUrl(media: MediaRef, variant: ImageVariant = 'thumb'): string {
    return this.media.url(media, variant);
  }

  privateFilePath(storageKey: string): string | null {
    return this.media.privateFilePath(storageKey);
  }
}
