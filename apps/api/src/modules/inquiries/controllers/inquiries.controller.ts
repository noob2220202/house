import type { InquiryCreated } from '@house/shared';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Principal } from '../../../common/auth/principal';
import { CurrentPrincipal, Public } from '../../../common/decorators';
import { THROTTLE } from '../../../common/throttle/throttle.constants';
import { SkipTermsCheck } from '../../auth';
import { InquiryContactEventDto, InquiryCreateDto } from '../dto';
import { InquiriesService } from '../services/inquiries.service';

/**
 * The customer's side (/api/v1/inquiries): public with an optional session. The office sites
 * (`<slug>.suncheonmap.kr`) are always anonymous, so guests send inquiries too (name + phone +
 * consent); a session on the main site makes it a member inquiry with a reply thread under MY.
 */
@ApiTags('inquiries')
@Public()
@Controller('inquiries')
export class InquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Post()
  @Throttle(THROTTLE.INQUIRY)
  create(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: InquiryCreateDto,
  ): Promise<InquiryCreated> {
    return this.inquiries.create(principal, dto);
  }

  /** 전화 / 문자 / 번호 복사 pressed: a beacon like the listing view (never blocked by terms). */
  @Post('contact-events')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(THROTTLE.WRITE)
  @SkipTermsCheck()
  async contactEvent(
    @CurrentPrincipal() principal: Principal | undefined,
    @Body() dto: InquiryContactEventDto,
  ): Promise<void> {
    await this.inquiries.contactEvent(principal, dto);
  }
}
