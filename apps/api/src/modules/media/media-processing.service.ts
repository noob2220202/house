import {
  ErrorCode,
  ERROR_MESSAGES,
  MediaKind,
  mediaRuleFor,
  MediaStatus,
  MediaVisibility,
  SNIFF_HEADER_BYTES,
  sniffMime,
} from '@house/shared';
import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
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
@Injectable()
export class MediaProcessingService {
  private readonly logger = new Logger(MediaProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorage,
    private readonly processor: ImageProcessor,
    private readonly files: MediaFiles,
  ) {}

  async processPending(mediaId: string): Promise<ProcessOutcome> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
      select: { id: true, status: true, deletedAt: true, storageKey: true, purpose: true },
    });
    if (!media || media.deletedAt || media.status !== MediaStatus.PENDING) {
      await this.storage.removeStaging(mediaId);
      return 'SKIPPED';
    }
    const data = await this.storage.readStaging(mediaId);
    const mime = data ? sniffMime(data.subarray(0, SNIFF_HEADER_BYTES)) : null;
    if (!data || !mime) {
      await this.markFailed(mediaId, ErrorCode.MEDIA_PROCESSING_FAILED);
      return 'FAILED';
    }

    const isDocument = mediaRuleFor(media.purpose).kind === MediaKind.DOCUMENT;
    try {
      return isDocument
        ? await this.finishDocument(mediaId, media.storageKey, data, mime)
        : await this.finishImage(mediaId, media.storageKey, data, mime);
    } catch (err) {
      if (!(err instanceof AppException)) throw err;
      this.logger.warn({ mediaId, code: err.code }, 'media rejected during processing');
      await this.markFailed(mediaId, err.code);
      await this.storage.removeStaging(mediaId);
      return 'FAILED';
    }
  }

  private async finishImage(
    mediaId: string,
    storageKey: string,
    data: Buffer,
    mime: string,
  ): Promise<ProcessOutcome> {
    const processed = await this.processor.processImage(data, mime);
    const variants = await this.files.writeImage(storageKey, processed);
    const { count } = await this.prisma.media.updateMany({
      where: { id: mediaId, status: MediaStatus.PENDING, deletedAt: null },
      data: {
        status: MediaStatus.READY,
        sizeBytes: processed.original.data.length,
        width: processed.original.width,
        height: processed.original.height,
        variants: variants,
        error: null,
      },
    });
    // Deleted while we were working: drop what we wrote (a duplicate job that finished first
    // wrote the same keys, so then the files stay).
    if (count === 0 && !(await this.isReadyAndLive(mediaId)))
      await this.files.removeImage(storageKey);
    await this.storage.removeStaging(mediaId);
    return count === 0 ? 'SKIPPED' : 'READY';
  }

  private async finishDocument(
    mediaId: string,
    storageKey: string,
    data: Buffer,
    mime: string,
  ): Promise<ProcessOutcome> {
    const doc = await this.processor.processDocument(data, mime);
    await this.storage.write(MediaVisibility.PRIVATE, storageKey, doc.data);
    const { count } = await this.prisma.media.updateMany({
      where: { id: mediaId, status: MediaStatus.PENDING, deletedAt: null },
      data: {
        status: MediaStatus.READY,
        mimeType: doc.mimeType,
        sizeBytes: doc.data.length,
        width: doc.width,
        height: doc.height,
        error: null,
      },
    });
    if (count === 0 && !(await this.isReadyAndLive(mediaId))) {
      await this.storage.remove(MediaVisibility.PRIVATE, [storageKey]);
    }
    await this.storage.removeStaging(mediaId);
    return count === 0 ? 'SKIPPED' : 'READY';
  }

  private async isReadyAndLive(mediaId: string): Promise<boolean> {
    const row = await this.prisma.media.findUnique({
      where: { id: mediaId },
      select: { status: true, deletedAt: true },
    });
    return row !== null && row.deletedAt === null && row.status === MediaStatus.READY;
  }

  /** Marks a PENDING upload FAILED with a user-safe message. */
  async markFailed(mediaId: string, code: ErrorCode = ErrorCode.MEDIA_PROCESSING_FAILED) {
    await this.prisma.media.updateMany({
      where: { id: mediaId, status: MediaStatus.PENDING },
      data: { status: MediaStatus.FAILED, error: ERROR_MESSAGES[code] },
    });
  }
}
