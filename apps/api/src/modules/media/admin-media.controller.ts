import {
  AdminRole,
  MediaStatus,
  type AdminMediaView,
  type MediaCleanupResult,
  type OwnMediaView,
  type Paginated,
} from '@house/shared';
import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuditService } from '../../common/audit/audit.service';
import type { AdminPrincipal } from '../../common/auth/principal';
import { AdminOnly, Audit, CurrentAdmin } from '../../common/decorators';
import { AdminMediaListQueryDto, IdParamDto, MediaUploadQueryDto } from './dto';
import { MediaCleanupService } from './media-cleanup.service';
import { MediaLibraryService } from './media-library.service';
import { MediaUploadService, type UploadedFileInput } from './media-upload.service';
import { MediaUploadInterceptor } from './upload.interceptor';

@ApiTags('media')
@Controller('admin/media')
@AdminOnly(AdminRole.OPERATOR)
export class AdminMediaController {
  constructor(
    private readonly uploads: MediaUploadService,
    private readonly library: MediaLibraryService,
    private readonly cleanup: MediaCleanupService,
    private readonly audit: AuditService,
  ) {}

  /** Banner / popup / 단지 / content images (multipart `file`). */
  @Post()
  @UseInterceptors(MediaUploadInterceptor)
  @Audit({ action: 'media.upload', resourceType: 'Media' })
  async upload(
    @Query() q: MediaUploadQueryDto,
    @UploadedFile() file: UploadedFileInput | undefined,
    @CurrentAdmin() admin: AdminPrincipal,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OwnMediaView> {
    const view = await this.uploads.upload(file, q.purpose, {
      kind: 'ADMIN',
      adminId: admin.adminId,
    });
    res.status(view.status === MediaStatus.PENDING ? HttpStatus.ACCEPTED : HttpStatus.CREATED);
    return view;
  }

  @Get()
  list(@Query() q: AdminMediaListQueryDto): Promise<Paginated<AdminMediaView>> {
    return this.library.listAll(q);
  }

  /** Runs the orphan cleanup now (it also runs hourly when JOBS_ENABLED). */
  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  @AdminOnly(AdminRole.ADMIN)
  @Audit({ action: 'media.cleanup', resourceType: 'Media' })
  runCleanup(): Promise<MediaCleanupResult> {
    return this.cleanup.run();
  }

  @Get(':id')
  get(@Param() p: IdParamDto): Promise<AdminMediaView> {
    return this.library.getForAdmin(p.id);
  }

  /** Streams the stored file (public or private). Every view is audited. */
  @Get(':id/file')
  @Header('Cache-Control', 'private, no-store')
  async file(@Param() p: IdParamDto): Promise<StreamableFile> {
    const file = await this.library.openForAdmin(p.id);
    this.audit.recordSafe({ action: 'media.file.view', resourceType: 'Media', resourceId: p.id });
    return new StreamableFile(file.stream, {
      type: file.mimeType,
      length: file.sizeBytes,
      disposition: `inline; filename="${file.filename}"`,
    });
  }

  /** Moderation: removes an unattached upload (attached ones are removed via their owner). */
  @Delete(':id')
  @AdminOnly(AdminRole.ADMIN)
  @Audit({ action: 'media.delete', resourceType: 'Media' })
  delete(@Param() p: IdParamDto): Promise<AdminMediaView> {
    return this.library.deleteAsAdmin(p.id);
  }
}
