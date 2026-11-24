import { type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { MediaUploadService } from './media-upload.service';
/** Multipart field carrying the file. */
export declare const UPLOAD_FIELD = "file";
/**
 * Parses `multipart/form-data` (multer memory storage) for upload routes. Runs after the guards
 * (auth, CSRF, throttling), so anonymous or forged requests never get their body read, and
 * validates `?purpose=` and the caller's right to it *before* reading the body, so the byte limit
 * is the purpose's own limit.
 * Multer errors become MEDIA_TOO_LARGE (413) / MEDIA_UPLOAD_INVALID (400).
 */
export declare class MediaUploadInterceptor implements NestInterceptor {
    private readonly uploads;
    private readonly byLimit;
    constructor(uploads: MediaUploadService);
    intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>>;
    private multerFor;
}
