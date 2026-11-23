import { MediaStatus, type MediaView, type OwnMediaView, type Paginated } from '@house/shared';
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
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { Principal, UserPrincipal } from '../../common/auth/principal';
import { CurrentPrincipal, CurrentUser, Public } from '../../common/decorators';
import { THROTTLE } from '../../common/throttle/throttle.constants';
import { IdParamDto, MediaUploadQueryDto, MyMediaListQueryDto } from './dto';
import { MediaLibraryService } from './media-library.service';
import { MediaUploadService, type UploadedFileInput } from './media-upload.service';
import { PRIVATE_FILE_HEADERS, privateFileResponse } from './private-file.response';
import { MediaUploadInterceptor } from './upload.interceptor';

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(
    private readonly uploads: MediaUploadService,
    private readonly library: MediaLibraryService,
  ) {}

  /** multipart `file`; 202 for images (the worker decodes them; poll GET /media/:id), 201 for PDFs. */
  @Post()
  @Throttle(THROTTLE.WRITE)
  @UseInterceptors(MediaUploadInterceptor)
  async upload(
    @Query() q: MediaUploadQueryDto,
    @UploadedFile() file: UploadedFileInput | undefined,
    @CurrentUser() user: UserPrincipal,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OwnMediaView> {
    const view = await this.uploads.upload(file, q.purpose, { kind: 'USER', principal: user });
    res.status(view.status === MediaStatus.PENDING ? HttpStatus.ACCEPTED : HttpStatus.CREATED);
    return view;
  }

  @Get()
  listMine(
    @Query() q: MyMediaListQueryDto,
    @CurrentUser() user: UserPrincipal,
  ): Promise<Paginated<OwnMediaView>> {
    return this.library.listMine(user, q);
  }

  @Get(':id')
  @Public()
  get(@Param() p: IdParamDto, @CurrentPrincipal() principal?: Principal): Promise<MediaView> {
    return this.library.getForViewer(p.id, principal);
  }

  /** Private file (agency documents): its uploader or staff of the agency it is attached to. */
  @Get(':id/private')
  @Header('Cache-Control', PRIVATE_FILE_HEADERS['Cache-Control'])
  @Header('Content-Security-Policy', PRIVATE_FILE_HEADERS['Content-Security-Policy'])
  @Header('X-Content-Type-Options', PRIVATE_FILE_HEADERS['X-Content-Type-Options'])
  @Header('Cross-Origin-Resource-Policy', PRIVATE_FILE_HEADERS['Cross-Origin-Resource-Policy'])
  async privateFile(
    @Param() p: IdParamDto,
    @CurrentUser() user: UserPrincipal,
  ): Promise<StreamableFile> {
    const file = await this.library.openPrivate(p.id, user);
    return privateFileResponse(file);
  }

  @Delete(':id')
  @Throttle(THROTTLE.WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param() p: IdParamDto, @CurrentUser() user: UserPrincipal): Promise<void> {
    return this.library.deleteMine(p.id, user);
  }
}
