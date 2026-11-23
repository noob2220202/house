import {
  dealRequestCreateSchema,
  type ContactGrantView,
  type DealRequestCreateInput,
  type MyDealRequestDetail,
  type MyDealRequestView,
  type Paginated,
} from '@house/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { UserPrincipal } from '../../../common/auth/principal';
import { CurrentUser } from '../../../common/decorators';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { THROTTLE } from '../../../common/throttle/throttle.constants';
import {
  ContactGrantDto,
  ContactGrantParamDto,
  DealRequestCloseDto,
  IdParamDto,
  MyDealRequestListQueryDto,
} from '../dto';
import { DealRequestsService } from '../services/deal-requests.service';

/** 내놓기/구하기 registration (login required; no phone verification — contact is typed). */
@ApiTags('deal-requests')
@Controller('deal-requests')
export class DealRequestsController {
  constructor(private readonly requests: DealRequestsService) {}

  @Post()
  @Throttle(THROTTLE.DEAL_REQUEST)
  create(
    @CurrentUser() user: UserPrincipal,
    @Body(new ZodValidationPipe(dealRequestCreateSchema)) dto: DealRequestCreateInput,
  ): Promise<MyDealRequestView> {
    return this.requests.create(user, dto);
  }
}

/** The requester's own requests (/api/v1/me/deal-requests). Not-owned ids answer 404. */
@ApiTags('deal-requests')
@Controller('me/deal-requests')
export class MyDealRequestsController {
  constructor(private readonly requests: DealRequestsService) {}

  @Get()
  list(
    @CurrentUser() user: UserPrincipal,
    @Query() q: MyDealRequestListQueryDto,
  ): Promise<Paginated<MyDealRequestView>> {
    return this.requests.listMine(user, q);
  }

  @Get(':id')
  get(@CurrentUser() user: UserPrincipal, @Param() p: IdParamDto): Promise<MyDealRequestDetail> {
    return this.requests.getMine(user, p.id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE.WRITE)
  cancel(@CurrentUser() user: UserPrincipal, @Param() p: IdParamDto): Promise<MyDealRequestView> {
    return this.requests.cancel(user, p.id);
  }

  /** OPEN → expiry pushed out by TTL_DAYS; EXPIRED → OPEN again (limited number of times). */
  @Post(':id/extend')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE.WRITE)
  extend(@CurrentUser() user: UserPrincipal, @Param() p: IdParamDto): Promise<MyDealRequestView> {
    return this.requests.extend(user, p.id);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE.WRITE)
  close(
    @CurrentUser() user: UserPrincipal,
    @Param() p: IdParamDto,
    @Body() dto: DealRequestCloseDto,
  ): Promise<MyDealRequestView> {
    return this.requests.close(user, p.id, dto);
  }

  @Post(':id/contact-grants')
  @Throttle(THROTTLE.WRITE)
  grant(
    @CurrentUser() user: UserPrincipal,
    @Param() p: IdParamDto,
    @Body() dto: ContactGrantDto,
  ): Promise<ContactGrantView> {
    return this.requests.grantContact(user, p.id, dto.agencyId);
  }

  @Delete(':id/contact-grants/:agencyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(THROTTLE.WRITE)
  revoke(@CurrentUser() user: UserPrincipal, @Param() p: ContactGrantParamDto): Promise<void> {
    return this.requests.revokeContact(user, p.id, p.agencyId);
  }
}
