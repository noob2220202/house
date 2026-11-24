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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaUploadInterceptor = exports.UPLOAD_FIELD = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const principal_1 = require("../../common/auth/principal");
const app_exception_1 = require("../../common/errors/app.exception");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const constants_1 = require("./constants");
const media_upload_service_1 = require("./media-upload.service");
/** Multipart field carrying the file. */
exports.UPLOAD_FIELD = 'file';
/**
 * Parses `multipart/form-data` (multer memory storage) for upload routes. Runs after the guards
 * (auth, CSRF, throttling), so anonymous or forged requests never get their body read, and
 * validates `?purpose=` and the caller's right to it *before* reading the body, so the byte limit
 * is the purpose's own limit.
 * Multer errors become MEDIA_TOO_LARGE (413) / MEDIA_UPLOAD_INVALID (400).
 */
let MediaUploadInterceptor = class MediaUploadInterceptor {
    constructor(uploads) {
        this.uploads = uploads;
        this.byLimit = new Map();
    }
    async intercept(context, next) {
        const req = context.switchToHttp().getRequest();
        const { purpose } = (0, zod_validation_pipe_1.parseOrThrow)(shared_1.mediaUploadQuerySchema, req.query);
        const principal = req.principal;
        if ((0, principal_1.isUserPrincipal)(principal)) {
            this.uploads.assertMayUpload(purpose, { kind: 'USER', principal });
        }
        else if ((0, principal_1.isAdminPrincipal)(principal)) {
            this.uploads.assertMayUpload(purpose, { kind: 'ADMIN', adminId: principal.adminId });
        }
        if (!req.is('multipart/form-data')) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.MEDIA_FILE_REQUIRED);
        }
        const maxBytes = this.uploads.maxBytesFor(purpose);
        try {
            return await this.multerFor(maxBytes).intercept(context, next);
        }
        catch (err) {
            throw mapMulterError(err, maxBytes);
        }
    }
    multerFor(maxBytes) {
        let interceptor = this.byLimit.get(maxBytes);
        if (!interceptor) {
            const Mixin = (0, platform_express_1.FileInterceptor)(exports.UPLOAD_FIELD, {
                limits: { ...constants_1.MULTIPART_LIMITS, fileSize: maxBytes },
                // Browsers send UTF-8 file names (Korean names would be mojibake as latin1).
                defParamCharset: 'utf8',
            });
            interceptor = new Mixin();
            this.byLimit.set(maxBytes, interceptor);
        }
        return interceptor;
    }
};
exports.MediaUploadInterceptor = MediaUploadInterceptor;
exports.MediaUploadInterceptor = MediaUploadInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [media_upload_service_1.MediaUploadService])
], MediaUploadInterceptor);
function mapMulterError(err, maxBytes) {
    if (err instanceof app_exception_1.AppException)
        return err;
    if (err instanceof common_1.PayloadTooLargeException) {
        return new app_exception_1.AppException(shared_1.ErrorCode.MEDIA_TOO_LARGE, {
            status: common_1.HttpStatus.PAYLOAD_TOO_LARGE,
            details: { maxBytes },
        });
    }
    if (err instanceof common_1.HttpException && err.getStatus() < 500) {
        return app_exception_1.AppException.badRequest(shared_1.ErrorCode.MEDIA_UPLOAD_INVALID);
    }
    return err;
}
//# sourceMappingURL=upload.interceptor.js.map