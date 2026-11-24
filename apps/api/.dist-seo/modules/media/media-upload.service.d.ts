import { type MediaPurpose, type OwnMediaView } from '@house/shared';
import type { Queue } from 'bullmq';
import type { UserPrincipal } from '../../common/auth/principal';
import { DailyCapService } from '../../common/throttle/daily-cap.service';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ImageProcessor } from './image-processor';
import { MediaStorage } from './media-storage';
import { MediaMapper } from './media.mapper';
/** The parts of a multer memory-storage file the service uses. */
export interface UploadedFileInput {
    buffer: Buffer;
    size: number;
    originalname: string;
}
export type MediaUploaderRef = {
    kind: 'USER';
    principal: UserPrincipal;
} | {
    kind: 'ADMIN';
    adminId: string;
};
export interface ProcessJobData {
    mediaId: string;
}
/**
 * Upload flow: authorize purpose → size → magic-byte sniff → header check → daily cap + quota → store.
 * The HTTP API never decodes images (no libvips/sharp call on untrusted bytes in this process): PDFs
 * are stored inline (201 READY, no decoding involved); every image and image document is staged and
 * processed by the media-processing worker process (202 PENDING, poll GET /media/:id). The header
 * check is pure TypeScript, so malformed and oversized images are still refused up front.
 */
export declare class MediaUploadService {
    private readonly prisma;
    private readonly storage;
    private readonly processor;
    private readonly mapper;
    private readonly dailyCaps;
    private readonly config;
    private readonly queue;
    private readonly logger;
    constructor(prisma: PrismaService, storage: MediaStorage, processor: ImageProcessor, mapper: MediaMapper, dailyCaps: DailyCapService, config: AppConfig, queue: Queue<ProcessJobData>);
    /** Per-file byte limit for a purpose (also used by the multipart interceptor). */
    maxBytesFor(purpose: MediaPurpose): number;
    upload(file: UploadedFileInput | undefined, purpose: MediaPurpose, uploader: MediaUploaderRef): Promise<OwnMediaView>;
    /** Also called by the multipart interceptor, so a forbidden purpose is refused before the body is read. */
    assertMayUpload(purpose: MediaPurpose, uploader: MediaUploaderRef): void;
    /** PDFs are stored as uploaded (completeness check only, no decoding). */
    private storePdf;
    /** PENDING row with the final key and output type; the worker writes the file and flips READY. */
    private enqueue;
    /** Insert under a per-user advisory lock so concurrent uploads cannot overshoot the quota. */
    private createRow;
    private assertQuota;
}
/** Display-only file name: base name, no control/quote characters, NFC, ≤ 255 chars. */
export declare function sanitizeFilename(name: string | undefined): string | null;
