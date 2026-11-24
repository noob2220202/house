import { ErrorCode, type ImageVariant, type MediaPurpose, type MediaView } from '@house/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService, type PrismaTx } from '../../prisma/prisma.service';
import { MediaStorage } from './media-storage';
import { MediaMapper } from './media.mapper';
import { type MediaRef } from './media.selects';
export interface MediaUsableRule {
    /** Accepted purpose(s); visibility follows from the purpose. */
    purpose: MediaPurpose | readonly MediaPurpose[];
    /** Only uploads of this user (omit for admin-curated purposes such as BANNER). */
    ownerUserId?: string;
    /** Only uploads not referenced anywhere yet (one-shot attachments: documents, deal-request photos). */
    unattached?: boolean;
    /**
     * Extra alternative accepted instead of `ownerUserId`, e.g. photos already attached to the same
     * listing: `{ listingPhotos: { some: { listingId } } }`.
     */
    orWhere?: Prisma.MediaWhereInput;
    /** Error thrown when any id is unusable (default MEDIA_INVALID, 400). */
    errorCode?: ErrorCode;
}
export interface MediaScrubResult {
    /** Uploads whose original file name was removed. */
    filenamesCleared: number;
    /** Unattached uploads soft-deleted (files go with the next cleanup purge). */
    deleted: number;
}
/**
 * What other modules use from the media domain. Attach/detach semantics:
 *  - attach = inside your transaction, `assertUsable(ids, rule, tx)` (locks the rows so they cannot
 *    be deleted concurrently), then create your FK row (ListingPhoto, Banner.pcMediaId…) with the
 *    SAME `tx`. A DB trigger also refuses any new reference to a soft-deleted row.
 *  - detach = delete/clear your FK row, then `released(ids, tx)` so the orphan grace period
 *    (MEDIA_ORPHAN_GRACE_HOURS) restarts; unreferenced uploads are collected by the cleanup job.
 * "Attached" is always derived from the FK relations, never from a flag that could drift.
 */
export declare class MediaService {
    private readonly prisma;
    private readonly storage;
    private readonly mapper;
    constructor(prisma: PrismaService, storage: MediaStorage, mapper: MediaMapper);
    /**
     * Throws (400) unless every id is a live, READY upload satisfying `rule`. Returns rows in input
     * order. With a transaction client the rows stay locked until it commits: FOR SHARE (blocks
     * deletes and cleanup), or FOR UPDATE for `unattached` rules so two transactions cannot both
     * claim the same one-shot upload. Locks are taken in id order (no deadlocks between attachers).
     */
    assertUsable(mediaIds: readonly string[], rule: MediaUsableRule, db?: PrismaTx): Promise<MediaRef[]>;
    /** Call after removing a reference: restarts the orphan grace period of those uploads. */
    released(mediaIds: readonly string[], db?: PrismaTx): Promise<void>;
    /**
     * Member withdrawal (PII scrub job, inside its transaction): forgets the uploaded file names of
     * all of the user's uploads (often real names, e.g. `홍길동_등록증.pdf`) and soft-deletes every
     * upload that is not attached anywhere, so the cleanup purge removes the files within the grace
     * period. Attached uploads stay (they belong to listings/agencies now, and agency documents follow
     * the registration-record retention policy); they are removed when their owner detaches them.
     */
    scrubOwner(userId: string, db: PrismaTx, now?: Date): Promise<MediaScrubResult>;
    /** Public URL of a variant (falls back to the full-size image). */
    url(ref: Pick<MediaRef, 'storageKey' | 'variants'>, variant?: ImageVariant): string;
    variantUrls(ref: Pick<MediaRef, 'storageKey' | 'variants'>): Record<ImageVariant, string>;
    /** Public views of READY public media, in input order (unknown/private ids are skipped). */
    views(mediaIds: readonly string[]): Promise<MediaView[]>;
    /** Absolute path of a PRIVATE file, guaranteed inside PRIVATE_UPLOAD_DIR (null otherwise). */
    privateFilePath(storageKey: string): string | null;
}
