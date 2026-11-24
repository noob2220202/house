"use strict";
/** Server-side tuning of the media pipeline (client-visible limits live in @house/shared). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MULTIPART_LIMITS = exports.CLEANUP_BATCH_SIZE = exports.ORPHAN_CLEANUP_CRON = exports.MEDIA_JOBS = exports.JPEG_DOCUMENT_QUALITY = exports.WEBP_QUALITY = exports.MEDIA_WORKER_CONCURRENCY = exports.SHARP_THREADS = exports.MAX_STORED_EDGE = void 0;
/** Longest edge of the stored "original" (and of documents re-encoded from images). */
exports.MAX_STORED_EDGE = 4096;
/** libvips threads per image operation (process-wide, in the worker process). */
exports.SHARP_THREADS = 2;
/** Background jobs processed at once by this process (one large decode at a time). */
exports.MEDIA_WORKER_CONCURRENCY = 1;
exports.WEBP_QUALITY = { variant: 82, original: 88 };
exports.JPEG_DOCUMENT_QUALITY = 90;
/** BullMQ job names on QUEUES.MEDIA_PROCESSING (the queue is owned by this module). */
exports.MEDIA_JOBS = {
    PROCESS: 'media.process',
    ORPHAN_CLEANUP: 'media.orphan-cleanup',
};
/** Hourly at :17 (off the top of the hour). */
exports.ORPHAN_CLEANUP_CRON = '17 * * * *';
/** Rows handled per cleanup phase per run (the job is repeatable, the rest goes next hour). */
exports.CLEANUP_BATCH_SIZE = 500;
/** Multipart limits besides the file size. */
exports.MULTIPART_LIMITS = { files: 1, fields: 4, parts: 5, fieldSize: 1024 };
//# sourceMappingURL=constants.js.map