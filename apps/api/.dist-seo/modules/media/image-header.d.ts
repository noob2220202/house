export interface HeaderDimensions {
    width: number;
    height: number;
}
/**
 * Pure-TypeScript header reader for JPEG / PNG / WebP: width × height from the container header,
 * without libvips. The HTTP API uses it to reject malformed or oversized images up front while all
 * actual decoding (sharp) happens in the worker process, so a libvips memory-safety bug triggered
 * by an upload cannot take down the process holding sessions, the DB pool and the secrets.
 * Returns null when the header is truncated or malformed. Pixel count does not depend on EXIF
 * orientation, so orientation is not read here.
 */
export declare function readImageHeader(data: Buffer, mime: string): HeaderDimensions | null;
