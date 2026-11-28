import {
  UserRole,
  agencyInquiryDeleteSchema,
  type AgencyInquiryDeleteInput,
  type AgencyInquiryPage,
  type AgencyInquiryReadAllResult,
  type AgencyInquiryView,
} from '@house/shared';
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
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { UserPrincipal } from '../../../common/auth/principal';
import { CurrentUser, Roles } from '../../../common/decorators';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { THROTTLE } from '../../../common/throttle/throttle.constants';
import {
  AgencyInquiryListQueryDto,
  AgencyInquiryReadAllDto,
  AgencyInquiryUpdateDto,
  IdParamDto,
  InquiryReplyDto,
} from '../dto';
import { AgencyInquiriesService } from '../services/agency-inquiries.service';

/**
 * Broker console inbox (/api/v1/agency/inquiries): ACTIVE members of an APPROVED office (403
 * otherwise); rows of other offices answer 404. Static `read` is declared before `:id`.
 */
@ApiTags('inquiries')
@Roles(UserRole.AGENT, UserRole.AGENCY_OWNER)
@Controller('agency/inquiries')
export class AgencyInquiriesController {
  constructor(private readonly inbox: AgencyInquiriesService) {}

  @Get()
  list(
    @CurrentUser() user: UserPrincipal,
    @Query() q: AgencyInquiryListQueryDto,
  ): Promise<AgencyInquiryPage> {
    return this.inbox.list(user, q);
  }

  /** `{ all: true }` → every inquiry of the office read. */
  @Post('read')
  @HttpCode(HttpStatus.OK)
  readAll(
    @CurrentUser() user: UserPrincipal,
    @Body() _dto: AgencyInquiryReadAllDto,
  ): Promise<AgencyInquiryReadAllResult> {
    return this.inbox.readAll(user);
  }

  @Get(':id')
  get(@CurrentUser() user: UserPrincipal, @Param() p: IdParamDto): Promise<AgencyInquiryView> {
    return this.inbox.get(user, p.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserPrincipal,
    @Param() p: IdParamDto,
    @Body() dto: AgencyInquiryUpdateDto,
  ): Promise<AgencyInquiryView> {
    return this.inbox.update(user, p.id, dto);
  }

  /** The office's answer (member inquiries only, else 409). → the thread. */
  @Post(':id/replies')
  @Throttle(THROTTLE.WRITE)
  reply(
    @CurrentUser() user: UserPrincipal,
    @Param() p: IdParamDto,
    @Body() dto: InquiryReplyDto,
  ): Promise<AgencyInquiryView> {
    return this.inbox.reply(user, p.id, dto);
  }

  /** Soft delete (스팸 처리 / 정리); the body `{ reason? }` is optional. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: UserPrincipal,
    @Param() p: IdParamDto,
    @Body(new ZodValidationPipe(agencyInquiryDeleteSchema)) dto: AgencyInquiryDeleteInput,
  ): Promise<void> {
    return this.inbox.remove(user, p.id, dto);
  }
}
