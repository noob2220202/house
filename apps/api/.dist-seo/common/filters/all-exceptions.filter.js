"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
exports.renderException = renderException;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const client_1 = require("@prisma/client");
const app_exception_1 = require("../errors/app.exception");
const STATUS_CODE = {
    400: shared_1.ErrorCode.BAD_REQUEST,
    401: shared_1.ErrorCode.UNAUTHENTICATED,
    403: shared_1.ErrorCode.FORBIDDEN,
    404: shared_1.ErrorCode.NOT_FOUND,
    405: shared_1.ErrorCode.NOT_FOUND,
    409: shared_1.ErrorCode.CONFLICT,
    413: shared_1.ErrorCode.PAYLOAD_TOO_LARGE,
    415: shared_1.ErrorCode.UNSUPPORTED_MEDIA_TYPE,
    429: shared_1.ErrorCode.RATE_LIMITED,
    503: shared_1.ErrorCode.SERVICE_UNAVAILABLE,
};
/** Converts any thrown value into the safe error shape `{ code, message, details?, requestId }`. */
function renderException(exception) {
    if (exception instanceof app_exception_1.AppException) {
        const res = exception.getResponse();
        return { status: exception.getStatus(), body: res };
    }
    if (exception instanceof common_1.HttpException) {
        const status = exception.getStatus();
        const code = STATUS_CODE[status] ?? (status >= 500 ? shared_1.ErrorCode.INTERNAL_ERROR : shared_1.ErrorCode.BAD_REQUEST);
        return { status, body: { code, message: shared_1.ERROR_MESSAGES[code] } };
    }
    if (exception instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (exception.code === 'P2002') {
            return { status: 409, body: { code: shared_1.ErrorCode.CONFLICT, message: shared_1.ERROR_MESSAGES.CONFLICT } };
        }
        // Foreign-key violation: e.g. an attach that lost the race against a delete of the target
        // (media reference guard trigger) or a parent row removed concurrently.
        if (exception.code === 'P2003') {
            return { status: 409, body: { code: shared_1.ErrorCode.CONFLICT, message: shared_1.ERROR_MESSAGES.CONFLICT } };
        }
        if (exception.code === 'P2025') {
            return {
                status: 404,
                body: { code: shared_1.ErrorCode.NOT_FOUND, message: shared_1.ERROR_MESSAGES.NOT_FOUND },
            };
        }
    }
    // body-parser / http-errors style errors (e.g. entity.too.large, malformed JSON)
    if (isHttpError(exception)) {
        const status = exception.status;
        const code = STATUS_CODE[status] ?? shared_1.ErrorCode.BAD_REQUEST;
        return { status, body: { code, message: shared_1.ERROR_MESSAGES[code] } };
    }
    return {
        status: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
        body: { code: shared_1.ErrorCode.INTERNAL_ERROR, message: shared_1.ERROR_MESSAGES.INTERNAL_ERROR },
    };
}
function isHttpError(e) {
    if (typeof e !== 'object' || e === null)
        return false;
    const r = e;
    return typeof r.status === 'number' && r.status >= 400 && r.status < 500 && r.expose === true;
}
let AllExceptionsFilter = class AllExceptionsFilter {
    constructor() {
        this.logger = new common_1.Logger('Exceptions');
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const req = ctx.getRequest();
        const res = ctx.getResponse();
        const { status, body } = renderException(exception);
        if (status >= 500) {
            this.logger.error({ err: exception, requestId: req.id, path: req.originalUrl }, exception instanceof Error ? exception.message : 'unhandled exception');
        }
        if (res.headersSent)
            return;
        res
            .status(status)
            .json({ ...body, requestId: typeof req.id === 'string' ? req.id : undefined });
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map