/** Server-side tuning of the media pipeline (client-visible limits live in @house/shared). */
/** Longest edge of the stored "original" (and of documents re-encoded from images). */
export declare const MAX_STORED_EDGE = 4096;
/** libvips threads per image operation (process-wide, in the worker process). */
export declare const SHARP_THREADS = 2;
/** Background jobs processed at once by this process (one large decode at a time). */
export declare const MEDIA_WORKER_CONCURRENCY = 1;
export declare const WEBP_QUALITY: {
    readonly variant: 82;
    readonly original: 88;
};
export declare const JPEG_DOCUMENT_QUALITY = 90;
/** BullMQ job names on QUEUES.MEDIA_PROCESSING (the queue is owned by this module). */
export declare const MEDIA_JOBS: {
    readonly PROCESS: "media.process";
    readonly ORPHAN_CLEANUP: "media.orphan-cleanup";
};
/** Hourly at :17 (off the top of the hour). */
export declare const ORPHAN_CLEANUP_CRON = "17 * * * *";
/** Rows handled per cleanup phase per run (the job is repeatable, the rest goes next hour). */
export declare const CLEANUP_BATCH_SIZE = 500;
/** Multipart limits besides the file size. */
export declare const MULTIPART_LIMITS: {
    readonly files: 1;
    readonly fields: 4;
    readonly parts: 5;
    readonly fieldSize: 1024;
};
