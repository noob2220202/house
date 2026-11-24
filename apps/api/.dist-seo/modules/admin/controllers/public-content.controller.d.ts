import { type FaqView, type LocalVideoView, type NoticeListItem, type NoticeView, type Paginated, type PublicSiteSettings } from '@house/shared';
import { FaqListQueryDto, IdParamDto, LocalVideoListQueryDto, PaginationQueryDto } from '../dto';
import { FaqsService } from '../services/faqs.service';
import { NoticesService } from '../services/notices.service';
import { SiteSettingsService } from '../services/site-settings.service';
import { VideosService } from '../services/videos.service';
/** Public site content: 공지사항, FAQ, 지역 영상, footer/business settings. */
export declare class PublicContentController {
    private readonly notices;
    private readonly faqs;
    private readonly videos;
    private readonly settings;
    constructor(notices: NoticesService, faqs: FaqsService, videos: VideosService, settings: SiteSettingsService);
    listNotices(q: PaginationQueryDto): Promise<Paginated<NoticeListItem>>;
    notice(p: IdParamDto, userAgent: string | undefined): Promise<NoticeView>;
    listFaqs(q: FaqListQueryDto): Promise<Paginated<FaqView>>;
    listVideos(q: LocalVideoListQueryDto): Promise<Paginated<LocalVideoView>>;
    siteSettings(): Promise<PublicSiteSettings>;
}
