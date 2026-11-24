import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@house/shared';
/** Status for a code: explicit table, then naming convention (*_NOT_FOUND → 404, *_DUPLICATE → 409), else 400. */
export declare function defaultStatusFor(code: ErrorCode): HttpStatus;
export interface AppExceptionOptions {
    status?: HttpStatus;
    /** Overrides the default Korean message for the code. Must be safe to show to users. */
    message?: string;
    /** Structured, user-safe details (e.g. validation issues, missing publish fields). */
    details?: unknown;
    cause?: unknown;
}
/**
 * The only exception app code should throw. Rendered by AllExceptionsFilter as
 * `{ code, message, details?, requestId }`.
 */
export declare class AppException extends HttpException {
    readonly code: ErrorCode;
    readonly details?: unknown;
    constructor(code: ErrorCode, options?: AppExceptionOptions);
    static badRequest(code?: ErrorCode, details?: unknown): AppException;
    static unauthenticated(code?: ErrorCode): AppException;
    static forbidden(code?: ErrorCode): AppException;
    static notFound(code?: ErrorCode): AppException;
    static conflict(code?: ErrorCode, details?: unknown): AppException;
}
