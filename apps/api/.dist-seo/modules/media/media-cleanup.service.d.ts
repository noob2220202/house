import { type MediaCleanupResult } from '@house/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaFiles } from './media-files';
/**
 * Orphan cleanup (idempotent, safe to run concurrently):
 *  1. PENDING uploads older than the grace period (lost jobs) → FAILED.
 *  2. Unattached uploads whose last attach/detach is older than the grace period → soft-deleted.
 *  3. Soft-deleted rows older than the grace period → files removed, row purged.
 * Rows are locked (FOR UPDATE SKIP LOCKED) and the orphan condition re-checked under the lock, so
 * an upload being attached concurrently (MediaService.assertUsable and the reference guard trigger
 * hold FOR SHARE) is never taken; an attach that comes after the soft-delete is refused by the
 * trigger. Soft-deleted rows that are still referenced (should not exist) are never purged and are
 * reported in the log.
 */
export declare class MediaCleanupService {
    private readonly prisma;
    private readonly files;
    private readonly logger;
    constructor(prisma: PrismaService, files: MediaFiles);
    run(now?: Date): Promise<MediaCleanupResult>;
    private reportDeletedButReferenced;
    private purge;
}
