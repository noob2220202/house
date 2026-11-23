import type { AdminFaqView, AdminLocalVideoView, AdminNoticeView, Paginated } from '@house/shared';
import { AdminPermission } from '@house/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { Audit, CurrentAdmin } from '../../../common/decorators';
import {
  FaqAdminListQueryDto,
  FaqInputDto,
  FaqOrderDto,
  FaqUpdateDto,
  IdParamDto,
  LocalVideoAdminListQueryDto,
  LocalVideoInputDto,
  LocalVideoUpdateDto,
  NoticeAdminListQueryDto,
  NoticeInputDto,
  NoticeUpdateDto,
} from '../dto';
import { RequirePermission } from '../permissions.decorator';
import { FaqsService } from '../services/faqs.service';
import { NoticesService } from '../services/notices.service';
import { VideosService } from '../services/videos.service';

@ApiTags('admin/content')
@RequirePermission(AdminPermission.CONTENT_MANAGE)
@Controller('admin/notices')
export class AdminNoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Get()
  list(@Query() q: NoticeAdminListQueryDto): Promise<Paginated<AdminNoticeView>> {
    return this.notices.adminList(q);
  }

  @Get(':id')
  detail(@Param() p: IdParamDto): Promise<AdminNoticeView> {
    return this.notices.adminDetail(p.id);
  }

  @Post()
  @Audit({ action: 'notice.create', resourceType: 'Notice' })
  create(
    @Body() dto: NoticeInputDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<AdminNoticeView> {
    return this.notices.create(dto, admin);
  }

  @Patch(':id')
  @Audit({ action: 'notice.update', resourceType: 'Notice' })
  update(@Param() p: IdParamDto, @Body() dto: NoticeUpdateDto): Promise<AdminNoticeView> {
    return this.notices.update(p.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'notice.delete', resourceType: 'Notice' })
  remove(@Param() p: IdParamDto): Promise<void> {
    return this.notices.remove(p.id);
  }
}

@ApiTags('admin/content')
@RequirePermission(AdminPermission.CONTENT_MANAGE)
@Controller('admin/faqs')
export class AdminFaqsController {
  constructor(private readonly faqs: FaqsService) {}

  @Get()
  list(@Query() q: FaqAdminListQueryDto): Promise<Paginated<AdminFaqView>> {
    return this.faqs.adminList(q);
  }

  /** Declared before `:id` routes so "order" is never parsed as an id. */
  @Put('order')
  @Audit({ action: 'faq.reorder', resourceType: 'Faq' })
  reorder(@Body() dto: FaqOrderDto): Promise<{ ids: string[] }> {
    return this.faqs.reorder(dto);
  }

  @Get(':id')
  detail(@Param() p: IdParamDto): Promise<AdminFaqView> {
    return this.faqs.adminDetail(p.id);
  }

  @Post()
  @Audit({ action: 'faq.create', resourceType: 'Faq' })
  create(@Body() dto: FaqInputDto): Promise<AdminFaqView> {
    return this.faqs.create(dto);
  }

  @Patch(':id')
  @Audit({ action: 'faq.update', resourceType: 'Faq' })
  update(@Param() p: IdParamDto, @Body() dto: FaqUpdateDto): Promise<AdminFaqView> {
    return this.faqs.update(p.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'faq.delete', resourceType: 'Faq' })
  remove(@Param() p: IdParamDto): Promise<void> {
    return this.faqs.remove(p.id);
  }
}

@ApiTags('admin/content')
@RequirePermission(AdminPermission.CONTENT_MANAGE)
@Controller('admin/videos')
export class AdminVideosController {
  constructor(private readonly videos: VideosService) {}

  @Get()
  list(@Query() q: LocalVideoAdminListQueryDto): Promise<Paginated<AdminLocalVideoView>> {
    return this.videos.adminList(q);
  }

  @Get(':id')
  detail(@Param() p: IdParamDto): Promise<AdminLocalVideoView> {
    return this.videos.adminDetail(p.id);
  }

  @Post()
  @Audit({ action: 'video.create', resourceType: 'LocalVideo' })
  create(@Body() dto: LocalVideoInputDto): Promise<AdminLocalVideoView> {
    return this.videos.create(dto);
  }

  @Patch(':id')
  @Audit({ action: 'video.update', resourceType: 'LocalVideo' })
  update(@Param() p: IdParamDto, @Body() dto: LocalVideoUpdateDto): Promise<AdminLocalVideoView> {
    return this.videos.update(p.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'video.delete', resourceType: 'LocalVideo' })
  remove(@Param() p: IdParamDto): Promise<void> {
    return this.videos.remove(p.id);
  }
}
