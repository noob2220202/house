import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiErrorBody, ERROR_MESSAGES, ErrorCode } from '@house/shared';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { AppException } from '../errors/app.exception';

const STATUS_CODE: Record<number, ErrorCode> = {
  400: ErrorCode.BAD_REQUEST,
  401: ErrorCode.UNAUTHENTICATED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  405: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  413: ErrorCode.PAYLOAD_TOO_LARGE,
  415: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
  429: ErrorCode.RATE_LIMITED,
  503: ErrorCode.SERVICE_UNAVAILABLE,
};

interface Rendered {
  status: number;
  body: ApiErrorBody;
}

/** Converts any thrown value into the safe error shape `{ code, message, details?, requestId }`. */
export function renderException(exception: unknown): Rendered {
  if (exception instanceof AppException) {
    const res = exception.getResponse() as ApiErrorBody;
    return { status: exception.getStatus(), body: res };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code =
      STATUS_CODE[status] ?? (status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST);
    return { status, body: { code, message: ERROR_MESSAGES[code] } };
  }
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2002') {
      return { status: 409, body: { code: ErrorCode.CONFLICT, message: ERROR_MESSAGES.CONFLICT } };
    }
    if (exception.code === 'P2025') {
      return {
        status: 404,
        body: { code: ErrorCode.NOT_FOUND, message: ERROR_MESSAGES.NOT_FOUND },
      };
    }
  }
  // body-parser / http-errors style errors (e.g. entity.too.large, malformed JSON)
  if (isHttpError(exception)) {
    const status = exception.status;
    const code = STATUS_CODE[status] ?? ErrorCode.BAD_REQUEST;
    return { status, body: { code, message: ERROR_MESSAGES[code] } };
  }
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: { code: ErrorCode.INTERNAL_ERROR, message: ERROR_MESSAGES.INTERNAL_ERROR },
  };
}

function isHttpError(e: unknown): e is { status: number; expose: boolean } {
  if (typeof e !== 'object' || e === null) return false;
  const r = e as Record<string, unknown>;
  return typeof r.status === 'number' && r.status >= 400 && r.status < 500 && r.expose === true;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const { status, body } = renderException(exception);

    if (status >= 500) {
      this.logger.error(
        { err: exception, requestId: req.id, path: req.originalUrl },
        exception instanceof Error ? exception.message : 'unhandled exception',
      );
    }
    if (res.headersSent) return;
    res
      .status(status)
      .json({ ...body, requestId: typeof req.id === 'string' ? req.id : undefined });
  }
}
