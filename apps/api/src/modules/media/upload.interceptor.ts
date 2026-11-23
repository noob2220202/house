import { ErrorCode, mediaUploadQuerySchema } from '@house/shared';
import {
  HttpException,
  HttpStatus,
  Injectable,
  PayloadTooLargeException,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { isAdminPrincipal, isUserPrincipal } from '../../common/auth/principal';
import { AppException } from '../../common/errors/app.exception';
import { parseOrThrow } from '../../common/pipes/zod-validation.pipe';
import { MULTIPART_LIMITS } from './constants';
import { MediaUploadService } from './media-upload.service';

/** Multipart field carrying the file. */
export const UPLOAD_FIELD = 'file';

/**
 * Parses `multipart/form-data` (multer memory storage) for upload routes. Runs after the guards
 * (auth, CSRF, throttling), so anonymous or forged requests never get their body read, and
 * validates `?purpose=` and the caller's right to it *before* reading the body, so the byte limit
 * is the purpose's own limit.
 * Multer errors become MEDIA_TOO_LARGE (413) / MEDIA_UPLOAD_INVALID (400).
 */
@Injectable()
export class MediaUploadInterceptor implements NestInterceptor {
  private readonly byLimit = new Map<number, NestInterceptor>();

  constructor(private readonly uploads: MediaUploadService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<Request>();
    const { purpose } = parseOrThrow(mediaUploadQuerySchema, req.query);
    const principal = req.principal;
    if (isUserPrincipal(principal)) {
      this.uploads.assertMayUpload(purpose, { kind: 'USER', principal });
    } else if (isAdminPrincipal(principal)) {
      this.uploads.assertMayUpload(purpose, { kind: 'ADMIN', adminId: principal.adminId });
    }
    if (!req.is('multipart/form-data')) {
      throw AppException.badRequest(ErrorCode.MEDIA_FILE_REQUIRED);
    }
    const maxBytes = this.uploads.maxBytesFor(purpose);
    try {
      return await this.multerFor(maxBytes).intercept(context, next);
    } catch (err) {
      throw mapMulterError(err, maxBytes);
    }
  }

  private multerFor(maxBytes: number): NestInterceptor {
    let interceptor = this.byLimit.get(maxBytes);
    if (!interceptor) {
      const Mixin = FileInterceptor(UPLOAD_FIELD, {
        limits: { ...MULTIPART_LIMITS, fileSize: maxBytes },
        // Browsers send UTF-8 file names (Korean names would be mojibake as latin1).
        defParamCharset: 'utf8',
      });
      interceptor = new Mixin();
      this.byLimit.set(maxBytes, interceptor);
    }
    return interceptor;
  }
}

function mapMulterError(err: unknown, maxBytes: number): unknown {
  if (err instanceof AppException) return err;
  if (err instanceof PayloadTooLargeException) {
    return new AppException(ErrorCode.MEDIA_TOO_LARGE, {
      status: HttpStatus.PAYLOAD_TOO_LARGE,
      details: { maxBytes },
    });
  }
  if (err instanceof HttpException && err.getStatus() < 500) {
    return AppException.badRequest(ErrorCode.MEDIA_UPLOAD_INVALID);
  }
  return err;
}
