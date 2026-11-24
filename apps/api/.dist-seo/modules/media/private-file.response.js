"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRIVATE_FILE_HEADERS = void 0;
exports.privateFileResponse = privateFileResponse;
const common_1 = require("@nestjs/common");
/**
 * Headers for streamed private files (agency documents, admin file view). The file never runs as
 * active content on the site's origin: CSP `sandbox` (no scripts, unique origin) and nosniff, and
 * non-images (PDFs are stored as uploaded and may carry JavaScript/launch actions) are downloads.
 */
exports.PRIVATE_FILE_HEADERS = {
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
};
function privateFileResponse(file) {
    const inline = file.mimeType.startsWith('image/');
    return new common_1.StreamableFile(file.stream, {
        type: file.mimeType,
        length: file.sizeBytes,
        disposition: `${inline ? 'inline' : 'attachment'}; filename="${file.filename}"`,
    });
}
//# sourceMappingURL=private-file.response.js.map