import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_MESSAGES, ErrorCode } from '@house/shared';

const DEFAULT_STATUS: Partial<Record<ErrorCode, HttpStatus>> = {
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  BAD_REQUEST: HttpStatus.BAD_REQUEST,
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
  AUTH_SESSION_EXPIRED: HttpStatus.UNAUTHORIZED,
  AUTH_INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  CSRF_FAILED: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  PAYLOAD_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
  UNSUPPORTED_MEDIA_TYPE: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  SERVICE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  AUTH_CONSENT_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  GEOCODE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
};

/** Status for a code: explicit table, then naming convention (*_NOT_FOUND → 404, *_DUPLICATE → 409), else 400. */
export function defaultStatusFor(code: ErrorCode): HttpStatus {
  const explicit = DEFAULT_STATUS[code];
  if (explicit) return explicit;
  if (code.endsWith('_NOT_FOUND')) return HttpStatus.NOT_FOUND;
  if (code.endsWith('_DUPLICATE')) return HttpStatus.CONFLICT;
  return HttpStatus.BAD_REQUEST;
}

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
export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, options: AppExceptionOptions = {}) {
    const status = options.status ?? defaultStatusFor(code);
    const message = options.message ?? ERROR_MESSAGES[code];
    super({ code, message, details: options.details }, status, { cause: options.cause });
    this.code = code;
    this.details = options.details;
  }

  static badRequest(code: ErrorCode = ErrorCode.BAD_REQUEST, details?: unknown): AppException {
    return new AppException(code, { status: HttpStatus.BAD_REQUEST, details });
  }

  static unauthenticated(code: ErrorCode = ErrorCode.UNAUTHENTICATED): AppException {
    return new AppException(code, { status: HttpStatus.UNAUTHORIZED });
  }

  static forbidden(code: ErrorCode = ErrorCode.FORBIDDEN): AppException {
    return new AppException(code, { status: HttpStatus.FORBIDDEN });
  }

  static notFound(code: ErrorCode = ErrorCode.NOT_FOUND): AppException {
    return new AppException(code, { status: HttpStatus.NOT_FOUND });
  }

  static conflict(code: ErrorCode = ErrorCode.CONFLICT, details?: unknown): AppException {
    return new AppException(code, { status: HttpStatus.CONFLICT, details });
  }
}
