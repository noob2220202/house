"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppException = void 0;
exports.defaultStatusFor = defaultStatusFor;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const DEFAULT_STATUS = {
    VALIDATION_FAILED: common_1.HttpStatus.BAD_REQUEST,
    BAD_REQUEST: common_1.HttpStatus.BAD_REQUEST,
    UNAUTHENTICATED: common_1.HttpStatus.UNAUTHORIZED,
    AUTH_SESSION_EXPIRED: common_1.HttpStatus.UNAUTHORIZED,
    AUTH_INVALID_CREDENTIALS: common_1.HttpStatus.UNAUTHORIZED,
    FORBIDDEN: common_1.HttpStatus.FORBIDDEN,
    CSRF_FAILED: common_1.HttpStatus.FORBIDDEN,
    NOT_FOUND: common_1.HttpStatus.NOT_FOUND,
    CONFLICT: common_1.HttpStatus.CONFLICT,
    PAYLOAD_TOO_LARGE: common_1.HttpStatus.PAYLOAD_TOO_LARGE,
    UNSUPPORTED_MEDIA_TYPE: common_1.HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    RATE_LIMITED: common_1.HttpStatus.TOO_MANY_REQUESTS,
    SERVICE_UNAVAILABLE: common_1.HttpStatus.SERVICE_UNAVAILABLE,
    AUTH_CONSENT_UNAVAILABLE: common_1.HttpStatus.SERVICE_UNAVAILABLE,
    GEOCODE_UNAVAILABLE: common_1.HttpStatus.SERVICE_UNAVAILABLE,
    INTERNAL_ERROR: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
};
/** Status for a code: explicit table, then naming convention (*_NOT_FOUND → 404, *_DUPLICATE → 409), else 400. */
function defaultStatusFor(code) {
    const explicit = DEFAULT_STATUS[code];
    if (explicit)
        return explicit;
    if (code.endsWith('_NOT_FOUND'))
        return common_1.HttpStatus.NOT_FOUND;
    if (code.endsWith('_DUPLICATE'))
        return common_1.HttpStatus.CONFLICT;
    return common_1.HttpStatus.BAD_REQUEST;
}
/**
 * The only exception app code should throw. Rendered by AllExceptionsFilter as
 * `{ code, message, details?, requestId }`.
 */
class AppException extends common_1.HttpException {
    constructor(code, options = {}) {
        const status = options.status ?? defaultStatusFor(code);
        const message = options.message ?? shared_1.ERROR_MESSAGES[code];
        super({ code, message, details: options.details }, status, { cause: options.cause });
        this.code = code;
        this.details = options.details;
    }
    static badRequest(code = shared_1.ErrorCode.BAD_REQUEST, details) {
        return new AppException(code, { status: common_1.HttpStatus.BAD_REQUEST, details });
    }
    static unauthenticated(code = shared_1.ErrorCode.UNAUTHENTICATED) {
        return new AppException(code, { status: common_1.HttpStatus.UNAUTHORIZED });
    }
    static forbidden(code = shared_1.ErrorCode.FORBIDDEN) {
        return new AppException(code, { status: common_1.HttpStatus.FORBIDDEN });
    }
    static notFound(code = shared_1.ErrorCode.NOT_FOUND) {
        return new AppException(code, { status: common_1.HttpStatus.NOT_FOUND });
    }
    static conflict(code = shared_1.ErrorCode.CONFLICT, details) {
        return new AppException(code, { status: common_1.HttpStatus.CONFLICT, details });
    }
}
exports.AppException = AppException;
//# sourceMappingURL=app.exception.js.map