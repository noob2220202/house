import { type MediaView, type OwnMediaView, type Paginated } from '@house/shared';
import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import type { Principal, UserPrincipal } from '../../common/auth/principal';
import { IdParamDto, MediaUploadQueryDto, MyMediaListQueryDto } from './dto';
import { MediaLibraryService } from './media-library.service';
import { MediaUploadService, type UploadedFileInput } from './media-upload.service';
export declare class MediaController {
    private readonly uploads;
    private readonly library;
    constructor(uploads: MediaUploadService, library: MediaLibraryService);
    /** multipart `file`; 202 for images (the worker decodes them; poll GET /media/:id), 201 for PDFs. */
    upload(q: MediaUploadQueryDto, file: UploadedFileInput | undefined, user: UserPrincipal, res: Response): Promise<OwnMediaView>;
    listMine(q: MyMediaListQueryDto, user: UserPrincipal): Promise<Paginated<OwnMediaView>>;
    get(p: IdParamDto, principal?: Principal): Promise<MediaView>;
    /** Private file (agency documents): its uploader or staff of the agency it is attached to. */
    privateFile(p: IdParamDto, user: UserPrincipal): Promise<StreamableFile>;
    delete(p: IdParamDto, user: UserPrincipal): Promise<void>;
}
