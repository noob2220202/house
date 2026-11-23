import {
  ErrorCode,
  IMAGE_VARIANTS,
  isHeifMime,
  MEDIA_MAX_INPUT_PIXELS,
  SniffedMime,
  type ImageVariant,
} from '@house/shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import sharp, { type Sharp } from 'sharp';
import { AppException } from '../../common/errors/app.exception';
import { JPEG_DOCUMENT_QUALITY, WEBP_QUALITY } from './constants';
import { HEIC_DECODER, type HeicDecoder } from './ports/heic-decoder.port';

export interface ProcessedFile {
  data: Buffer;
  width: number;
  height: number;
}

export interface ProcessedImage {
  /** Full-size, oriented, metadata-free webp (kept so variants can be regenerated later). */
  original: ProcessedFile;
  variants: Record<ImageVariant, ProcessedFile>;
}

export interface ProcessedDocument {
  data: Buffer;
  mimeType: string;
  ext: string;
  width: number | null;
  height: number | null;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

const VARIANT_NAMES = Object.keys(IMAGE_VARIANTS) as ImageVariant[];
const SHARP_FORMAT: Record<string, string> = {
  [SniffedMime.JPEG]: 'jpeg',
  [SniffedMime.PNG]: 'png',
  [SniffedMime.WEBP]: 'webp',
};

const unsupported = (cause?: unknown): AppException =>
  new AppException(ErrorCode.MEDIA_UNSUPPORTED_TYPE, {
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    cause,
  });
const processingFailed = (cause?: unknown): AppException =>
  new AppException(ErrorCode.MEDIA_PROCESSING_FAILED, {
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    cause,
  });

function assertPixels(width: number, height: number): void {
  if (width < 1 || height < 1 || width * height > MEDIA_MAX_INPUT_PIXELS) {
    throw new AppException(ErrorCode.MEDIA_DIMENSIONS_INVALID, {
      details: { width, height, maxPixels: MEDIA_MAX_INPUT_PIXELS },
    });
  }
}

/**
 * sharp pipeline. Every output is re-encoded (never the uploaded bytes for images), auto-rotated
 * from EXIF orientation, converted to sRGB and stripped of all metadata (EXIF/GPS/XMP/ICC).
 * Errors are AppExceptions (MEDIA_*), which the worker treats as permanent failures.
 */
@Injectable()
export class ImageProcessor {
  constructor(@Inject(HEIC_DECODER) private readonly heic: HeicDecoder) {}

  /** Throws MEDIA_HEIC_UNSUPPORTED (415) up front when HEIC/HEIF cannot be converted here. */
  assertDecodable(mime: string): void {
    if (isHeifMime(mime) && !this.heic.supported) {
      throw new AppException(ErrorCode.MEDIA_HEIC_UNSUPPORTED, {
        status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      });
    }
  }

  /**
   * Reads the header only (cheap) and validates format + pixel count. Returns null for HEIC/HEIF,
   * whose size is only known after decoding (they always go to the worker).
   */
  async probe(data: Buffer, mime: string): Promise<ImageDimensions | null> {
    if (isHeifMime(mime) || mime === SniffedMime.PDF) return null;
    let meta: sharp.Metadata;
    try {
      meta = await sharp(data, { limitInputPixels: false }).metadata();
    } catch (cause) {
      throw unsupported(cause);
    }
    if (meta.format !== SHARP_FORMAT[mime] || !meta.width || !meta.height) throw unsupported();
    assertPixels(meta.width, meta.height);
    // EXIF orientations 5–8 swap the axes.
    const swap = (meta.orientation ?? 1) >= 5;
    return swap
      ? { width: meta.height, height: meta.width }
      : { width: meta.width, height: meta.height };
  }

  async processImage(data: Buffer, mime: string): Promise<ProcessedImage> {
    const base = await this.open(data, mime);
    try {
      const [original, ...variants] = await Promise.all([
        render(base.clone().webp({ quality: WEBP_QUALITY.original })),
        ...VARIANT_NAMES.map((name) => {
          const spec = IMAGE_VARIANTS[name];
          return render(
            base
              .clone()
              .resize({
                width: spec.width,
                height: spec.height,
                fit: spec.fit,
                withoutEnlargement: true,
              })
              .webp({ quality: WEBP_QUALITY.variant }),
          );
        }),
      ]);
      if (!original) throw processingFailed();
      const out = {} as Record<ImageVariant, ProcessedFile>;
      VARIANT_NAMES.forEach((name, i) => {
        const v = variants[i];
        if (!v) throw processingFailed();
        out[name] = v;
      });
      return { original, variants: out };
    } catch (err) {
      if (err instanceof AppException) throw err;
      throw processingFailed(err);
    }
  }

  /** Private documents: PDFs are stored as uploaded; images are re-encoded without metadata. */
  async processDocument(data: Buffer, mime: string): Promise<ProcessedDocument> {
    if (mime === SniffedMime.PDF) {
      assertPdfComplete(data);
      return { data, mimeType: SniffedMime.PDF, ext: 'pdf', width: null, height: null };
    }
    const base = await this.open(data, mime);
    try {
      if (mime === SniffedMime.PNG) {
        const png = await render(base.png({ compressionLevel: 9 }));
        return { ...png, mimeType: SniffedMime.PNG, ext: 'png' };
      }
      const jpeg = await render(base.jpeg({ quality: JPEG_DOCUMENT_QUALITY, mozjpeg: true }));
      return { ...jpeg, mimeType: SniffedMime.JPEG, ext: 'jpg' };
    } catch (err) {
      if (err instanceof AppException) throw err;
      throw processingFailed(err);
    }
  }

  private async open(data: Buffer, mime: string): Promise<Sharp> {
    if (isHeifMime(mime)) {
      const raw = await this.heic.decode(data);
      assertPixels(raw.width, raw.height);
      return sharp(raw.data, {
        raw: { width: raw.width, height: raw.height, channels: raw.channels },
      });
    }
    await this.probe(data, mime);
    return sharp(data, { limitInputPixels: MEDIA_MAX_INPUT_PIXELS, failOn: 'error' }).rotate();
  }
}

async function render(pipeline: Sharp): Promise<ProcessedFile> {
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** A PDF must end with %%EOF (allowing trailing whitespace); truncated uploads are rejected. */
function assertPdfComplete(data: Buffer): void {
  const tail = data.subarray(Math.max(0, data.length - 1024)).toString('latin1');
  if (!/%%EOF\s*$/.test(tail)) throw processingFailed();
}
