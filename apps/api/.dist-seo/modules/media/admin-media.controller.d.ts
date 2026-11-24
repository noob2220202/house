import { type AdminMediaView, type MediaCleanupResult, type OwnMediaView, type Paginated } from '@house/shared';
import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { AuditService } from '../../common/audit/audit.service';
import type { AdminPrincipal } from '../../common/auth/principal';
import { AdminMediaListQueryDto, IdParamDto, MediaUploadQueryDto } from './dto';
import { MediaCleanupService } from './media-cleanup.service';
import { MediaLibraryService } from './media-library.service';
import { MediaUploadService, type UploadedFileInput } from './media-upload.service';
export declare class AdminMediaController {
    private readonly uploads;
    private readonly library;
    private readonly cleanup;
    private readonly audit;
    constructor(uploads: MediaUploadService, library: MediaLibraryService, cleanup: MediaCleanupService, audit: AuditService);
    /** Banner / popup / 단지 / content images (multipart `file`). */
    upload(q: MediaUploadQueryDto, file: UploadedFileInput | undefined, admin: AdminPrincipal, res: Response): Promise<OwnMediaView>;
    list(q: AdminMediaListQueryDto): Promise<Paginated<AdminMediaView>>;
    /** Runs the orphan cleanup now (it also runs hourly when JOBS_ENABLED). */
    runCleanup(): Promise<MediaCleanupResult>;
    get(p: IdParamDto): Promise<AdminMediaView>;
    /** Streams the stored file (public or private). Every view is audited. */
    file(p: IdParamDto): Promise<StreamableFile>;
    /** Moderation: removes an unattached upload (attached ones are removed via their owner). */
    delete(p: IdParamDto): Promise<AdminMediaView>;
}
