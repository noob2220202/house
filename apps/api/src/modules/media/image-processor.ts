import {
  ErrorCode,
  IMAGE_VARIANTS,
  isHeifMime,
  MEDIA_MAX_INPUT_PIXELS,
  SniffedMime,
  type ImageVariant,
} from '@house/shared';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import sharp, { type Metadata, type Sharp } from 'sharp';
import { AppException } from '../../common/errors/app.exception';
import { JPEG_DOCUMENT_QUALITY, MAX_STORED_EDGE, SHARP_THREADS, WEBP_QUALITY } from './constants';
import { HEIC_DECODER, type HeicDecoder } from './ports/heic-decoder.port';

export interface ProcessedFile {
  data: Buffer;
  width: number;
  height: number;
}

export interface ProcessedImage {
  /** Oriented, metadata-free webp, longest edge ≤ MAX_STORED_EDGE (kept to regenerate variants). */
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

/** MEDIA_DIMENSIONS_INVALID (400) unless 1 ≤ width·height ≤ MEDIA_MAX_INPUT_PIXELS. */
export function assertPixels(width: number, height: number): void {
  if (width < 1 || height < 1 || width * height > MEDIA_MAX_INPUT_PIXELS) {
    throw new AppException(ErrorCode.MEDIA_DIMENSIONS_INVALID, {
      details: { width, height, maxPixels: MEDIA_MAX_INPUT_PIXELS },
    });
  }
}

/** Output format of an image document: PNG stays PNG (scans with text), everything else → JPEG. */
export function documentOutputFor(mime: string): { mimeType: string; ext: string } {
  return mime === SniffedMime.PNG
    ? { mimeType: SniffedMime.PNG, ext: 'png' }
    : { mimeType: SniffedMime.JPEG, ext: 'jpg' };
}

interface Decoded {
  data: Buffer;
  info: { width: number; height: number; channels: 1 | 2 | 3 | 4 };
}

let sharpTuned = false;
/** Process-wide: few libvips threads per image and no operation cache. */
function tuneSharp(): void {
  if (sharpTuned) return;
  sharp.concurrency(SHARP_THREADS);
  sharp.cache(false);
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
@Injectable()
export class ImageProcessor {
  constructor(@Inject(HEIC_DECODER) private readonly heic: HeicDecoder) {
    tuneSharp();
  }

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
    let meta: Metadata;
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
    const decoded = await this.decode(data, mime);
    try {
      const original = await render(fromRaw(decoded).webp({ quality: WEBP_QUALITY.original }));
      const variants = {} as Record<ImageVariant, ProcessedFile>;
      for (const name of VARIANT_NAMES) {
        const spec = IMAGE_VARIANTS[name];
        variants[name] = await render(
          fromRaw(decoded)
            .resize({
              width: spec.width,
              height: spec.height,
              fit: spec.fit,
              withoutEnlargement: true,
            })
            .webp({ quality: WEBP_QUALITY.variant }),
        );
      }
      return { original, variants };
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
    const decoded = await this.decode(data, mime);
    const out = documentOutputFor(mime);
    try {
      const file =
        out.mimeType === SniffedMime.PNG
          ? await render(fromRaw(decoded).png({ compressionLevel: 9 }))
          : await render(
              fromRaw(decoded)
                .flatten({ background: '#ffffff' })
                .jpeg({ quality: JPEG_DOCUMENT_QUALITY, mozjpeg: true }),
            );
      return { ...file, ...out };
    } catch (err) {
      if (err instanceof AppException) throw err;
      throw processingFailed(err);
    }
  }

  /** Oriented, sRGB, 8-bit pixels, longest edge ≤ MAX_STORED_EDGE (never enlarged). */
  private async decode(data: Buffer, mime: string): Promise<Decoded> {
    let pipeline: Sharp;
    if (isHeifMime(mime)) {
      const raw = await this.heic.decode(data);
      assertPixels(raw.width, raw.height);
      pipeline = sharp(raw.data, {
        raw: { width: raw.width, height: raw.height, channels: raw.channels },
      });
    } else {
      await this.probe(data, mime);
      pipeline = sharp(data, {
        limitInputPixels: MEDIA_MAX_INPUT_PIXELS,
        failOn: 'error',
        sequentialRead: true,
      }).rotate();
    }
    try {
      const { data: pixels, info } = await pipeline
        .resize({
          width: MAX_STORED_EDGE,
          height: MAX_STORED_EDGE,
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
    } catch (err) {
      if (err instanceof AppException) throw err;
      throw processingFailed(err);
    }
  }
}

function fromRaw({ data, info }: Decoded): Sharp {
  return sharp(data, { raw: info });
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
