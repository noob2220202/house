import { ErrorCode } from '@house/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ImageProcessor } from './image-processor';
import { MediaStorage } from './media-storage';
import { MediaFiles } from './media-files';
export type ProcessOutcome = 'READY' | 'FAILED' | 'SKIPPED';
/**
 * Background processing of PENDING images and image documents (worker side). Idempotent: only a PENDING, live row is
 * processed, and the READY transition is conditional, so retries and duplicate jobs are harmless.
 * Invalid images (AppException) fail permanently; I/O errors are rethrown for BullMQ to retry.
 */
export declare class MediaProcessingService {
    private readonly prisma;
    private readonly storage;
    private readonly processor;
    private readonly files;
    private readonly logger;
    constructor(prisma: PrismaService, storage: MediaStorage, processor: ImageProcessor, files: MediaFiles);
    processPending(mediaId: string): Promise<ProcessOutcome>;
    private finishImage;
    private finishDocument;
    private isReadyAndLive;
    /** Marks a PENDING upload FAILED with a user-safe message. */
    markFailed(mediaId: string, code?: ErrorCode): Promise<void>;
}
