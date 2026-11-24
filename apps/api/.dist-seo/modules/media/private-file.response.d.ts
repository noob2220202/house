import { StreamableFile } from '@nestjs/common';
import type { MediaFileStream } from './media-library.service';
/**
 * Headers for streamed private files (agency documents, admin file view). The file never runs as
 * active content on the site's origin: CSP `sandbox` (no scripts, unique origin) and nosniff, and
 * non-images (PDFs are stored as uploaded and may carry JavaScript/launch actions) are downloads.
 */
export declare const PRIVATE_FILE_HEADERS: {
    readonly 'Cache-Control': "private, no-store";
    readonly 'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";
    readonly 'X-Content-Type-Options': "nosniff";
    readonly 'Cross-Origin-Resource-Policy': "same-origin";
};
export declare function privateFileResponse(file: MediaFileStream): StreamableFile;
