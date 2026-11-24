import { ErrorCode, MediaPurpose, type ImageVariant } from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaTx } from '../../../prisma/prisma.service';
import { MediaService, type DiscardedMedia } from '../../media/media.service';

export type { DiscardedMedia };

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
  /**
   * Retention purge, inside the transaction that deleted the referencing rows: soft-deletes the
   * uploads that are no longer attached anywhere (and forgets their file names).
   */
  discard(mediaIds: readonly string[], tx: PrismaTx, now?: Date): Promise<DiscardedMedia[]>;
  /** After that transaction committed: erases the discarded files (best effort). */
  removeFiles(rows: readonly DiscardedMedia[]): Promise<void>;
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

  async assertCoverUsable(mediaId: string, userId: string, tx: PrismaTx): Promise<void> {
    await this.media.assertUsable(
      [mediaId],
      {
        purpose: [MediaPurpose.AGENCY_COVER, MediaPurpose.AGENCY_LOGO],
        ownerUserId: userId,
        errorCode: ErrorCode.AGENCY_COVER_INVALID,
      },
      tx,
    );
  }

  released(mediaIds: readonly string[], tx: PrismaTx): Promise<void> {
    return this.media.released(mediaIds, tx);
  }

  discard(mediaIds: readonly string[], tx: PrismaTx, now?: Date): Promise<DiscardedMedia[]> {
    return this.media.discard(mediaIds, tx, now);
  }

  removeFiles(rows: readonly DiscardedMedia[]): Promise<void> {
    return this.media.removeFiles(rows);
  }

  publicUrl(media: MediaRef, variant: ImageVariant = 'thumb'): string {
    return this.media.url(media, variant);
  }

  privateFilePath(storageKey: string): string | null {
    return this.media.privateFilePath(storageKey);
  }
}
