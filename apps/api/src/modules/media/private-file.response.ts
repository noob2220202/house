import { StreamableFile } from '@nestjs/common';
import type { MediaFileStream } from './media-library.service';

/**
 * Headers for streamed private files (agency documents, admin file view). The file never runs as
 * active content on the site's origin: CSP `sandbox` (no scripts, unique origin) and nosniff, and
 * non-images (PDFs are stored as uploaded and may carry JavaScript/launch actions) are downloads.
 */
export const PRIVATE_FILE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'Content-Security-Policy':
    "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
} as const;

export function privateFileResponse(file: MediaFileStream): StreamableFile {
  const inline = file.mimeType.startsWith('image/');
  return new StreamableFile(file.stream, {
    type: file.mimeType,
    length: file.sizeBytes,
    disposition: `${inline ? 'inline' : 'attachment'}; filename="${file.filename}"`,
  });
}
