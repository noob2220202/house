import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUES } from '../../queue/queue.constants';
import { AdminMediaController } from './admin-media.controller';
import { ImageProcessor } from './image-processor';
import { MediaProcessor } from './jobs/media.processor';
import { MediaCleanupService } from './media-cleanup.service';
import { MediaFiles } from './media-files';
import { MediaLibraryService } from './media-library.service';
import { MediaProcessingService } from './media-processing.service';
import { MediaStorage } from './media-storage';
import { MediaUploadService } from './media-upload.service';
import { MediaController } from './media.controller';
import { MediaMapper } from './media.mapper';
import { MediaService } from './media.service';
import { HEIC_DECODER, SharpHeicDecoder } from './ports/heic-decoder.port';
import { MediaUploadInterceptor } from './upload.interceptor';

/**
 * Media: uploads (sniffed, sanitized, webp variants), private documents, background processing,
 * orphan cleanup. Other modules import this module and use MediaService (see its doc comment).
 */
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.MEDIA_PROCESSING })],
  controllers: [MediaController, AdminMediaController],
  providers: [
    { provide: HEIC_DECODER, useClass: SharpHeicDecoder },
    MediaStorage,
    MediaFiles,
    MediaMapper,
    ImageProcessor,
    MediaService,
    MediaUploadService,
    MediaLibraryService,
    MediaProcessingService,
    MediaCleanupService,
    MediaUploadInterceptor,
    MediaProcessor,
  ],
  exports: [MediaService],
})
export class MediaModule {}
