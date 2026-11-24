"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MediaProcessingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaProcessingService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../common/errors/app.exception");
const prisma_service_1 = require("../../prisma/prisma.service");
const image_processor_1 = require("./image-processor");
const media_storage_1 = require("./media-storage");
const media_files_1 = require("./media-files");
/**
 * Background processing of PENDING images and image documents (worker side). Idempotent: only a PENDING, live row is
 * processed, and the READY transition is conditional, so retries and duplicate jobs are harmless.
 * Invalid images (AppException) fail permanently; I/O errors are rethrown for BullMQ to retry.
 */
let MediaProcessingService = MediaProcessingService_1 = class MediaProcessingService {
    constructor(prisma, storage, processor, files) {
        this.prisma = prisma;
        this.storage = storage;
        this.processor = processor;
        this.files = files;
        this.logger = new common_1.Logger(MediaProcessingService_1.name);
    }
    async processPending(mediaId) {
        const media = await this.prisma.media.findUnique({
            where: { id: mediaId },
            select: { id: true, status: true, deletedAt: true, storageKey: true, purpose: true },
        });
        if (!media || media.deletedAt || media.status !== shared_1.MediaStatus.PENDING) {
            await this.storage.removeStaging(mediaId);
            return 'SKIPPED';
        }
        const data = await this.storage.readStaging(mediaId);
        const mime = data ? (0, shared_1.sniffMime)(data.subarray(0, shared_1.SNIFF_HEADER_BYTES)) : null;
        if (!data || !mime) {
            await this.markFailed(mediaId, shared_1.ErrorCode.MEDIA_PROCESSING_FAILED);
            return 'FAILED';
        }
        const isDocument = (0, shared_1.mediaRuleFor)(media.purpose).kind === shared_1.MediaKind.DOCUMENT;
        try {
            return isDocument
                ? await this.finishDocument(mediaId, media.storageKey, data, mime)
                : await this.finishImage(mediaId, media.storageKey, data, mime);
        }
        catch (err) {
            if (!(err instanceof app_exception_1.AppException))
                throw err;
            this.logger.warn({ mediaId, code: err.code }, 'media rejected during processing');
            await this.markFailed(mediaId, err.code);
            await this.storage.removeStaging(mediaId);
            return 'FAILED';
        }
    }
    async finishImage(mediaId, storageKey, data, mime) {
        const processed = await this.processor.processImage(data, mime);
        const variants = await this.files.writeImage(storageKey, processed);
        const { count } = await this.prisma.media.updateMany({
            where: { id: mediaId, status: shared_1.MediaStatus.PENDING, deletedAt: null },
            data: {
                status: shared_1.MediaStatus.READY,
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
    async finishDocument(mediaId, storageKey, data, mime) {
        const doc = await this.processor.processDocument(data, mime);
        await this.storage.write(shared_1.MediaVisibility.PRIVATE, storageKey, doc.data);
        const { count } = await this.prisma.media.updateMany({
            where: { id: mediaId, status: shared_1.MediaStatus.PENDING, deletedAt: null },
            data: {
                status: shared_1.MediaStatus.READY,
                mimeType: doc.mimeType,
                sizeBytes: doc.data.length,
                width: doc.width,
                height: doc.height,
                error: null,
            },
        });
        if (count === 0 && !(await this.isReadyAndLive(mediaId))) {
            await this.storage.remove(shared_1.MediaVisibility.PRIVATE, [storageKey]);
        }
        await this.storage.removeStaging(mediaId);
        return count === 0 ? 'SKIPPED' : 'READY';
    }
    async isReadyAndLive(mediaId) {
        const row = await this.prisma.media.findUnique({
            where: { id: mediaId },
            select: { status: true, deletedAt: true },
        });
        return row !== null && row.deletedAt === null && row.status === shared_1.MediaStatus.READY;
    }
    /** Marks a PENDING upload FAILED with a user-safe message. */
    async markFailed(mediaId, code = shared_1.ErrorCode.MEDIA_PROCESSING_FAILED) {
        await this.prisma.media.updateMany({
            where: { id: mediaId, status: shared_1.MediaStatus.PENDING },
            data: { status: shared_1.MediaStatus.FAILED, error: shared_1.ERROR_MESSAGES[code] },
        });
    }
};
exports.MediaProcessingService = MediaProcessingService;
exports.MediaProcessingService = MediaProcessingService = MediaProcessingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        media_storage_1.MediaStorage,
        image_processor_1.ImageProcessor,
        media_files_1.MediaFiles])
], MediaProcessingService);
//# sourceMappingURL=media-processing.service.js.map