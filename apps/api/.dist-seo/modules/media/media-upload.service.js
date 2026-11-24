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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MediaUploadService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaUploadService = void 0;
exports.sanitizeFilename = sanitizeFilename;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@house/shared");
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../common/errors/app.exception");
const daily_cap_service_1 = require("../../common/throttle/daily-cap.service");
const app_config_service_1 = require("../../config/app-config.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const queue_constants_1 = require("../../queue/queue.constants");
const constants_1 = require("./constants");
const image_header_1 = require("./image-header");
const image_processor_1 = require("./image-processor");
const media_storage_1 = require("./media-storage");
const media_mapper_1 = require("./media.mapper");
const media_selects_1 = require("./media.selects");
const MB = 1024 * 1024;
/**
 * Upload flow: authorize purpose → size → magic-byte sniff → header check → daily cap + quota → store.
 * The HTTP API never decodes images (no libvips/sharp call on untrusted bytes in this process): PDFs
 * are stored inline (201 READY, no decoding involved); every image and image document is staged and
 * processed by the media-processing worker process (202 PENDING, poll GET /media/:id). The header
 * check is pure TypeScript, so malformed and oversized images are still refused up front.
 */
let MediaUploadService = MediaUploadService_1 = class MediaUploadService {
    constructor(prisma, storage, processor, mapper, dailyCaps, config, queue) {
        this.prisma = prisma;
        this.storage = storage;
        this.processor = processor;
        this.mapper = mapper;
        this.dailyCaps = dailyCaps;
        this.config = config;
        this.queue = queue;
        this.logger = new common_1.Logger(MediaUploadService_1.name);
    }
    /** Per-file byte limit for a purpose (also used by the multipart interceptor). */
    maxBytesFor(purpose) {
        return (0, shared_1.mediaMaxBytes)(purpose, Math.floor(this.config.get('MAX_UPLOAD_MB') * MB));
    }
    async upload(file, purpose, uploader) {
        this.assertMayUpload(purpose, uploader);
        if (!file || file.size === 0 || file.buffer.length === 0) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.MEDIA_FILE_REQUIRED);
        }
        const maxBytes = this.maxBytesFor(purpose);
        if (file.size > maxBytes) {
            throw new app_exception_1.AppException(shared_1.ErrorCode.MEDIA_TOO_LARGE, {
                status: common_1.HttpStatus.PAYLOAD_TOO_LARGE,
                details: { maxBytes },
            });
        }
        const rule = (0, shared_1.mediaRuleFor)(purpose);
        const mime = (0, shared_1.sniffMime)(file.buffer.subarray(0, shared_1.SNIFF_HEADER_BYTES));
        if (!mime || !(0, shared_1.isAcceptedMime)(purpose, mime)) {
            throw new app_exception_1.AppException(shared_1.ErrorCode.MEDIA_UNSUPPORTED_TYPE, {
                status: common_1.HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                details: { accepted: rule.accept },
            });
        }
        this.processor.assertDecodable(mime);
        const isPdf = mime === shared_1.SniffedMime.PDF;
        // HEIC/HEIF dimensions are only known after decoding; the worker checks them.
        if (!isPdf && !(0, shared_1.isHeifMime)(mime)) {
            const dims = (0, image_header_1.readImageHeader)(file.buffer, mime);
            if (!dims) {
                throw new app_exception_1.AppException(shared_1.ErrorCode.MEDIA_UNSUPPORTED_TYPE, {
                    status: common_1.HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    details: { accepted: rule.accept },
                });
            }
            (0, image_processor_1.assertPixels)(dims.width, dims.height);
        }
        const userId = uploader.kind === 'USER' ? uploader.principal.userId : null;
        if (userId) {
            await this.dailyCaps.consume('MEDIA_UPLOAD', userId);
            await this.assertQuota(this.prisma, userId, file.size, false);
        }
        const base = {
            purpose,
            visibility: rule.visibility,
            ownerUserId: userId,
            ownerAdminId: uploader.kind === 'ADMIN' ? uploader.adminId : null,
            sha256: (0, node_crypto_1.createHash)('sha256').update(file.buffer).digest('hex'),
            originalFilename: sanitizeFilename(file.originalname),
        };
        if (rule.kind === shared_1.MediaKind.DOCUMENT && isPdf)
            return this.storePdf(file.buffer, base);
        if (rule.kind === shared_1.MediaKind.DOCUMENT) {
            const out = (0, image_processor_1.documentOutputFor)(mime);
            return this.enqueue(file.buffer, file.size, base, {
                mimeType: out.mimeType,
                storageKey: this.storage.newPrivateKey(out.ext),
            });
        }
        return this.enqueue(file.buffer, file.size, base, {
            mimeType: 'image/webp',
            storageKey: this.storage.newPublicImageKey(),
        });
    }
    /** Also called by the multipart interceptor, so a forbidden purpose is refused before the body is read. */
    assertMayUpload(purpose, uploader) {
        const allowed = uploader.kind === 'USER'
            ? (0, shared_1.canUserUpload)(purpose, uploader.principal.role)
            : (0, shared_1.canAdminUpload)(purpose);
        if (!allowed)
            throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.MEDIA_PURPOSE_NOT_ALLOWED);
    }
    /** PDFs are stored as uploaded (completeness check only, no decoding). */
    async storePdf(data, base) {
        const doc = await this.processor.processDocument(data, shared_1.SniffedMime.PDF);
        const key = this.storage.newPrivateKey(doc.ext);
        await this.storage.write(shared_1.MediaVisibility.PRIVATE, key, doc.data);
        const row = await this.createRow({
            ...base,
            status: shared_1.MediaStatus.READY,
            mimeType: doc.mimeType,
            sizeBytes: doc.data.length,
            width: doc.width,
            height: doc.height,
            storageKey: key,
        }, false).catch(async (err) => {
            await this.storage.remove(shared_1.MediaVisibility.PRIVATE, [key]);
            throw err;
        });
        return this.mapper.toOwnView(row);
    }
    /** PENDING row with the final key and output type; the worker writes the file and flips READY. */
    async enqueue(data, size, base, target) {
        const row = await this.createRow({ ...base, ...target, status: shared_1.MediaStatus.PENDING, sizeBytes: size }, true);
        try {
            await this.storage.writeStaging(row.id, data);
            await this.queue.add(constants_1.MEDIA_JOBS.PROCESS, { mediaId: row.id }, { jobId: row.id });
        }
        catch (err) {
            this.logger.error({ err, mediaId: row.id }, 'failed to queue media processing');
            await this.storage.removeStaging(row.id).catch(() => undefined);
            await this.prisma.media.delete({ where: { id: row.id } }).catch(() => undefined);
            throw new app_exception_1.AppException(shared_1.ErrorCode.SERVICE_UNAVAILABLE, { cause: err });
        }
        return this.mapper.toOwnView(row);
    }
    /** Insert under a per-user advisory lock so concurrent uploads cannot overshoot the quota. */
    createRow(data, pending) {
        const userId = data.ownerUserId;
        return this.prisma.$transaction(async (tx) => {
            if (userId) {
                await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtextextended(${`media-quota:${userId}`}, 0))`;
                await this.assertQuota(tx, userId, data.sizeBytes, pending);
            }
            return tx.media.create({ data, select: media_selects_1.mediaViewSelect });
        });
    }
    async assertQuota(db, userId, incomingBytes, pending) {
        const live = { ownerUserId: userId, deletedAt: null };
        const [usage, pendingCount] = await Promise.all([
            db.media.aggregate({ where: live, _sum: { sizeBytes: true }, _count: { _all: true } }),
            pending ? db.media.count({ where: { ...live, status: shared_1.MediaStatus.PENDING } }) : 0,
        ]);
        const usedBytes = usage._sum.sizeBytes ?? 0;
        if (usage._count._all >= shared_1.MEDIA_USER_QUOTA.maxFiles ||
            usedBytes + incomingBytes > shared_1.MEDIA_USER_QUOTA.maxBytes) {
            throw app_exception_1.AppException.conflict(shared_1.ErrorCode.MEDIA_QUOTA_EXCEEDED, {
                usedBytes,
                maxBytes: shared_1.MEDIA_USER_QUOTA.maxBytes,
                files: usage._count._all,
                maxFiles: shared_1.MEDIA_USER_QUOTA.maxFiles,
            });
        }
        if (pendingCount >= shared_1.MEDIA_USER_QUOTA.maxPending) {
            throw new app_exception_1.AppException(shared_1.ErrorCode.MEDIA_TOO_MANY_PENDING, {
                status: common_1.HttpStatus.TOO_MANY_REQUESTS,
            });
        }
    }
};
exports.MediaUploadService = MediaUploadService;
exports.MediaUploadService = MediaUploadService = MediaUploadService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, bullmq_1.InjectQueue)(queue_constants_1.QUEUES.MEDIA_PROCESSING)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        media_storage_1.MediaStorage,
        image_processor_1.ImageProcessor,
        media_mapper_1.MediaMapper,
        daily_cap_service_1.DailyCapService,
        app_config_service_1.AppConfig, Function])
], MediaUploadService);
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const UNSAFE_FILENAME_CHARS = /[\u0000-\u001f\u007f"<>]/g;
/** Display-only file name: base name, no control/quote characters, NFC, ≤ 255 chars. */
function sanitizeFilename(name) {
    if (!name)
        return null;
    const base = name.split(/[\\/]/).pop() ?? '';
    const clean = base.normalize('NFC').replace(UNSAFE_FILENAME_CHARS, '').trim();
    return clean.length === 0 ? null : clean.slice(0, 255);
}
//# sourceMappingURL=media-upload.service.js.map