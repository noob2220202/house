import {
  type FaqView,
  isBotUserAgent,
  type LocalVideoView,
  type NoticeListItem,
  type NoticeView,
  type Paginated,
  type PublicSiteSettings,
} from '@house/shared';
import { Controller, Get, Header, Headers, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators';
import { FaqListQueryDto, IdParamDto, LocalVideoListQueryDto, PaginationQueryDto } from '../dto';
import { FaqsService } from '../services/faqs.service';
import { NoticesService } from '../services/notices.service';
import { SiteSettingsService } from '../services/site-settings.service';
import { VideosService } from '../services/videos.service';

/** Public site content: 공지사항, FAQ, 지역 영상, footer/business settings. */
@ApiTags('content')
@Public()
@Controller()
export class PublicContentController {
  constructor(
    private readonly notices: NoticesService,
    private readonly faqs: FaqsService,
    private readonly videos: VideosService,
    private readonly settings: SiteSettingsService,
  ) {}

  @Get('notices')
  @Header('Cache-Control', 'public, max-age=60')
  listNotices(@Query() q: PaginationQueryDto): Promise<Paginated<NoticeListItem>> {
    return this.notices.publicList(q);
  }

  @Get('notices/:id')
  @Header('Cache-Control', 'no-cache')
  notice(
    @Param() p: IdParamDto,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<NoticeView> {
    return this.notices.publicDetail(p.id, !isBotUserAgent(userAgent));
  }

  @Get('faqs')
  @Header('Cache-Control', 'public, max-age=60')
  listFaqs(@Query() q: FaqListQueryDto): Promise<Paginated<FaqView>> {
    return this.faqs.publicList(q);
  }

  @Get('videos')
  @Header('Cache-Control', 'public, max-age=60')
  listVideos(@Query() q: LocalVideoListQueryDto): Promise<Paginated<LocalVideoView>> {
    return this.videos.publicList(q);
  }

  @Get('site-settings/public')
  @Header('Cache-Control', 'public, max-age=300')
  siteSettings(): Promise<PublicSiteSettings> {
    return this.settings.publicSettings();
  }
}
