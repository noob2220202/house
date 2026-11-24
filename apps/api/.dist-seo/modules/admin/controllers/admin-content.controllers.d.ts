import type { AdminFaqView, AdminLocalVideoView, AdminNoticeView, Paginated } from '@house/shared';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { FaqAdminListQueryDto, FaqInputDto, FaqOrderDto, FaqUpdateDto, IdParamDto, LocalVideoAdminListQueryDto, LocalVideoInputDto, LocalVideoUpdateDto, NoticeAdminListQueryDto, NoticeInputDto, NoticeUpdateDto, VideoOrderDto } from '../dto';
import { FaqsService } from '../services/faqs.service';
import { NoticesService } from '../services/notices.service';
import { VideosService } from '../services/videos.service';
export declare class AdminNoticesController {
    private readonly notices;
    constructor(notices: NoticesService);
    list(q: NoticeAdminListQueryDto): Promise<Paginated<AdminNoticeView>>;
    detail(p: IdParamDto): Promise<AdminNoticeView>;
    create(dto: NoticeInputDto, admin: AdminPrincipal): Promise<AdminNoticeView>;
    update(p: IdParamDto, dto: NoticeUpdateDto): Promise<AdminNoticeView>;
    remove(p: IdParamDto): Promise<void>;
}
export declare class AdminFaqsController {
    private readonly faqs;
    constructor(faqs: FaqsService);
    list(q: FaqAdminListQueryDto): Promise<Paginated<AdminFaqView>>;
    /** Declared before `:id` routes so "order" is never parsed as an id. */
    reorder(dto: FaqOrderDto): Promise<{
        ids: string[];
    }>;
    detail(p: IdParamDto): Promise<AdminFaqView>;
    create(dto: FaqInputDto): Promise<AdminFaqView>;
    update(p: IdParamDto, dto: FaqUpdateDto): Promise<AdminFaqView>;
    remove(p: IdParamDto): Promise<void>;
}
export declare class AdminVideosController {
    private readonly videos;
    constructor(videos: VideosService);
    list(q: LocalVideoAdminListQueryDto): Promise<Paginated<AdminLocalVideoView>>;
    /** `{ ids }` in display order → sortOrder 1…n. Declared before `:id` routes. */
    reorder(dto: VideoOrderDto): Promise<void>;
    detail(p: IdParamDto): Promise<AdminLocalVideoView>;
    create(dto: LocalVideoInputDto): Promise<AdminLocalVideoView>;
    update(p: IdParamDto, dto: LocalVideoUpdateDto): Promise<AdminLocalVideoView>;
    remove(p: IdParamDto): Promise<void>;
}
