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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageProcessor = void 0;
exports.assertPixels = assertPixels;
exports.documentOutputFor = documentOutputFor;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const sharp_1 = __importDefault(require("sharp"));
const app_exception_1 = require("../../common/errors/app.exception");
const constants_1 = require("./constants");
const heic_decoder_port_1 = require("./ports/heic-decoder.port");
const VARIANT_NAMES = Object.keys(shared_1.IMAGE_VARIANTS);
const SHARP_FORMAT = {
    [shared_1.SniffedMime.JPEG]: 'jpeg',
    [shared_1.SniffedMime.PNG]: 'png',
    [shared_1.SniffedMime.WEBP]: 'webp',
};
const unsupported = (cause) => new app_exception_1.AppException(shared_1.ErrorCode.MEDIA_UNSUPPORTED_TYPE, {
    status: common_1.HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    cause,
});
const processingFailed = (cause) => new app_exception_1.AppException(shared_1.ErrorCode.MEDIA_PROCESSING_FAILED, {
    status: common_1.HttpStatus.UNPROCESSABLE_ENTITY,
    cause,
});
/** MEDIA_DIMENSIONS_INVALID (400) unless 1 ≤ width·height ≤ MEDIA_MAX_INPUT_PIXELS. */
function assertPixels(width, height) {
    if (width < 1 || height < 1 || width * height > shared_1.MEDIA_MAX_INPUT_PIXELS) {
        throw new app_exception_1.AppException(shared_1.ErrorCode.MEDIA_DIMENSIONS_INVALID, {
            details: { width, height, maxPixels: shared_1.MEDIA_MAX_INPUT_PIXELS },
        });
    }
}
/** Output format of an image document: PNG stays PNG (scans with text), everything else → JPEG. */
function documentOutputFor(mime) {
    return mime === shared_1.SniffedMime.PNG
        ? { mimeType: shared_1.SniffedMime.PNG, ext: 'png' }
        : { mimeType: shared_1.SniffedMime.JPEG, ext: 'jpg' };
}
let sharpTuned = false;
/** Process-wide: few libvips threads per image and no operation cache. */
function tuneSharp() {
    if (sharpTuned)
        return;
    sharp_1.default.concurrency(constants_1.SHARP_THREADS);
    sharp_1.default.cache(false);
    sharpTuned = true;
}
/**
 * sharp pipeline. Every output is re-encoded (never the uploaded bytes for images), auto-rotated
 * from EXIF orientation, converted to sRGB and stripped of all metadata (EXIF/GPS/XMP/ICC).
 * Memory: the input is decoded ONCE (shrink-on-load where the format allows) into an oriented
 * sRGB pixel buffer capped at MAX_STORED_EDGE, and every output is then encoded from that buffer
 * one after another, so a job holds at most one full decode plus one ≤ 4096² buffer.
 * Errors are AppExceptions (MEDIA_*), which the worker treats as permanent failures.
 */
let ImageProcessor = class ImageProcessor {
    constructor(heic) {
        this.heic = heic;
        tuneSharp();
    }
    /** Throws MEDIA_HEIC_UNSUPPORTED (415) up front when HEIC/HEIF cannot be converted here. */
    assertDecodable(mime) {
        if ((0, shared_1.isHeifMime)(mime) && !this.heic.supported) {
            throw new app_exception_1.AppException(shared_1.ErrorCode.MEDIA_HEIC_UNSUPPORTED, {
                status: common_1.HttpStatus.UNSUPPORTED_MEDIA_TYPE,
            });
        }
    }
    /**
     * Reads the header only (cheap) and validates format + pixel count. Returns null for HEIC/HEIF,
     * whose size is only known after decoding (they always go to the worker).
     */
    async probe(data, mime) {
        if ((0, shared_1.isHeifMime)(mime) || mime === shared_1.SniffedMime.PDF)
            return null;
        let meta;
        try {
            meta = await (0, sharp_1.default)(data, { limitInputPixels: false }).metadata();
        }
        catch (cause) {
            throw unsupported(cause);
        }
        if (meta.format !== SHARP_FORMAT[mime] || !meta.width || !meta.height)
            throw unsupported();
        assertPixels(meta.width, meta.height);
        // EXIF orientations 5–8 swap the axes.
        const swap = (meta.orientation ?? 1) >= 5;
        return swap
            ? { width: meta.height, height: meta.width }
            : { width: meta.width, height: meta.height };
    }
    async processImage(data, mime) {
        const decoded = await this.decode(data, mime);
        try {
            const original = await render(fromRaw(decoded).webp({ quality: constants_1.WEBP_QUALITY.original }));
            const variants = {};
            for (const name of VARIANT_NAMES) {
                const spec = shared_1.IMAGE_VARIANTS[name];
                variants[name] = await render(fromRaw(decoded)
                    .resize({
                    width: spec.width,
                    height: spec.height,
                    fit: spec.fit,
                    withoutEnlargement: true,
                })
                    .webp({ quality: constants_1.WEBP_QUALITY.variant }));
            }
            return { original, variants };
        }
        catch (err) {
            if (err instanceof app_exception_1.AppException)
                throw err;
            throw processingFailed(err);
        }
    }
    /** Private documents: PDFs are stored as uploaded; images are re-encoded without metadata. */
    async processDocument(data, mime) {
        if (mime === shared_1.SniffedMime.PDF) {
            assertPdfComplete(data);
            return { data, mimeType: shared_1.SniffedMime.PDF, ext: 'pdf', width: null, height: null };
        }
        const decoded = await this.decode(data, mime);
        const out = documentOutputFor(mime);
        try {
            const file = out.mimeType === shared_1.SniffedMime.PNG
                ? await render(fromRaw(decoded).png({ compressionLevel: 9 }))
                : await render(fromRaw(decoded)
                    .flatten({ background: '#ffffff' })
                    .jpeg({ quality: constants_1.JPEG_DOCUMENT_QUALITY, mozjpeg: true }));
            return { ...file, ...out };
        }
        catch (err) {
            if (err instanceof app_exception_1.AppException)
                throw err;
            throw processingFailed(err);
        }
    }
    /** Oriented, sRGB, 8-bit pixels, longest edge ≤ MAX_STORED_EDGE (never enlarged). */
    async decode(data, mime) {
        let pipeline;
        if ((0, shared_1.isHeifMime)(mime)) {
            const raw = await this.heic.decode(data);
            assertPixels(raw.width, raw.height);
            pipeline = (0, sharp_1.default)(raw.data, {
                raw: { width: raw.width, height: raw.height, channels: raw.channels },
            });
        }
        else {
            await this.probe(data, mime);
            pipeline = (0, sharp_1.default)(data, {
                limitInputPixels: shared_1.MEDIA_MAX_INPUT_PIXELS,
                failOn: 'error',
                sequentialRead: true,
            }).rotate();
        }
        try {
            const { data: pixels, info } = await pipeline
                .resize({
                width: constants_1.MAX_STORED_EDGE,
                height: constants_1.MAX_STORED_EDGE,
                fit: 'inside',
                withoutEnlargement: true,
            })
                .toColourspace('srgb')
                .raw({ depth: 'uchar' })
                .toBuffer({ resolveWithObject: true });
            return {
                data: pixels,
                info: { width: info.width, height: info.height, channels: info.channels },
            };
        }
        catch (err) {
            if (err instanceof app_exception_1.AppException)
                throw err;
            throw processingFailed(err);
        }
    }
};
exports.ImageProcessor = ImageProcessor;
exports.ImageProcessor = ImageProcessor = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(heic_decoder_port_1.HEIC_DECODER)),
    __metadata("design:paramtypes", [Object])
], ImageProcessor);
function fromRaw({ data, info }) {
    return (0, sharp_1.default)(data, { raw: info });
}
async function render(pipeline) {
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
}
/** A PDF must end with %%EOF (allowing trailing whitespace); truncated uploads are rejected. */
function assertPdfComplete(data) {
    const tail = data.subarray(Math.max(0, data.length - 1024)).toString('latin1');
    if (!/%%EOF\s*$/.test(tail))
        throw processingFailed();
}
//# sourceMappingURL=image-processor.js.map