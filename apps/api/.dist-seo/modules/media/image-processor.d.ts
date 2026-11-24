import { type ImageVariant } from '@house/shared';
import { type HeicDecoder } from './ports/heic-decoder.port';
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
/** MEDIA_DIMENSIONS_INVALID (400) unless 1 ≤ width·height ≤ MEDIA_MAX_INPUT_PIXELS. */
export declare function assertPixels(width: number, height: number): void;
/** Output format of an image document: PNG stays PNG (scans with text), everything else → JPEG. */
export declare function documentOutputFor(mime: string): {
    mimeType: string;
    ext: string;
};
/**
 * sharp pipeline. Every output is re-encoded (never the uploaded bytes for images), auto-rotated
 * from EXIF orientation, converted to sRGB and stripped of all metadata (EXIF/GPS/XMP/ICC).
 * Memory: the input is decoded ONCE (shrink-on-load where the format allows) into an oriented
 * sRGB pixel buffer capped at MAX_STORED_EDGE, and every output is then encoded from that buffer
 * one after another, so a job holds at most one full decode plus one ≤ 4096² buffer.
 * Errors are AppExceptions (MEDIA_*), which the worker treats as permanent failures.
 */
export declare class ImageProcessor {
    private readonly heic;
    constructor(heic: HeicDecoder);
    /** Throws MEDIA_HEIC_UNSUPPORTED (415) up front when HEIC/HEIF cannot be converted here. */
    assertDecodable(mime: string): void;
    /**
     * Reads the header only (cheap) and validates format + pixel count. Returns null for HEIC/HEIF,
     * whose size is only known after decoding (they always go to the worker).
     */
    probe(data: Buffer, mime: string): Promise<ImageDimensions | null>;
    processImage(data: Buffer, mime: string): Promise<ProcessedImage>;
    /** Private documents: PDFs are stored as uploaded; images are re-encoded without metadata. */
    processDocument(data: Buffer, mime: string): Promise<ProcessedDocument>;
    /** Oriented, sRGB, 8-bit pixels, longest edge ≤ MAX_STORED_EDGE (never enlarged). */
    private decode;
}
