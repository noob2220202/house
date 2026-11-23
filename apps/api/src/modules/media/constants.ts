/** Server-side tuning of the media pipeline (client-visible limits live in @house/shared). */

/** Images above either threshold are processed by the media-processing worker (202 PENDING). */
export const ASYNC_PROCESSING_THRESHOLD = {
  bytes: 6 * 1024 * 1024,
  pixels: 24_000_000,
} as const;

/** Longest edge of the stored "original" (and of documents re-encoded from images). */
export const MAX_STORED_EDGE = 4096;
/** libvips threads per image operation (process-wide; the API shares the process). */
export const SHARP_THREADS = 2;
/** Background jobs processed at once by this process (one large decode at a time). */
export const MEDIA_WORKER_CONCURRENCY = 1;

export const WEBP_QUALITY = { variant: 82, original: 88 } as const;
export const JPEG_DOCUMENT_QUALITY = 90;

/** BullMQ job names on QUEUES.MEDIA_PROCESSING (the queue is owned by this module). */
export const MEDIA_JOBS = {
  PROCESS: 'media.process',
  ORPHAN_CLEANUP: 'media.orphan-cleanup',
} as const;

/** Hourly at :17 (off the top of the hour). */
export const ORPHAN_CLEANUP_CRON = '17 * * * *';
/** Rows handled per cleanup phase per run (the job is repeatable, the rest goes next hour). */
export const CLEANUP_BATCH_SIZE = 500;

/** Multipart limits besides the file size. */
export const MULTIPART_LIMITS = { files: 1, fields: 4, parts: 5, fieldSize: 1024 } as const;
