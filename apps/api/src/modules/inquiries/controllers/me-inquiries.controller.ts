import type { MyInquiryDetail, MyInquiryListItem, Paginated } from '@house/shared';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { UserPrincipal } from '../../../common/auth/principal';
import { CurrentUser } from '../../../common/decorators';
import { THROTTLE } from '../../../common/throttle/throttle.constants';
import { IdParamDto, InquiryReplyDto, MyInquiryListQueryDto } from '../dto';
import { MyInquiriesService } from '../services/my-inquiries.service';

/** MY > 문의 내역 (/api/v1/me/inquiries): the member's own written inquiries; others answer 404. */
@ApiTags('inquiries')
@Controller('me/inquiries')
export class MyInquiriesController {
  constructor(private readonly mine: MyInquiriesService) {}

  @Get()
  list(
    @CurrentUser() user: UserPrincipal,
    @Query() q: MyInquiryListQueryDto,
  ): Promise<Paginated<MyInquiryListItem>> {
    return this.mine.list(user, q);
  }

  @Get(':id')
  get(@CurrentUser() user: UserPrincipal, @Param() p: IdParamDto): Promise<MyInquiryDetail> {
    return this.mine.get(user, p.id);
  }

  /** Follow-up in the thread → the thread. */
  @Post(':id/messages')
  @Throttle(THROTTLE.INQUIRY)
  followUp(
    @CurrentUser() user: UserPrincipal,
    @Param() p: IdParamDto,
    @Body() dto: InquiryReplyDto,
  ): Promise<MyInquiryDetail> {
    return this.mine.followUp(user, p.id, dto);
  }
}
