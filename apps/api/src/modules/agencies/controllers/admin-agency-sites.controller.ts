import {
  AdminRole,
  type AdminAgencySiteListItem,
  type AdminAgencySiteResponse,
  type AgencySubscriptionView,
  type AgencySubscriptionsResponse,
  type Paginated,
} from '@house/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { AdminOnly, CurrentAdmin } from '../../../common/decorators';
import {
  AdminAgencySiteDecisionDto,
  AdminAgencySiteListQueryDto,
  AdminSubscriptionCreateDto,
  AdminSubscriptionUpdateDto,
  IdParamDto,
} from '../dto';
import { AgencySiteReviewService } from '../services/agency-site-review.service';
import { AgencySubscriptionsService } from '../services/agency-subscriptions.service';

/**
 * Back-office 사무소 홈페이지 queue + decisions and 이용권 records (/api/v1/admin/...). Every
 * mutation is audited in its service transaction (`agency_site.*`, `subscription.*`).
 */
@ApiTags('admin/agencies')
@AdminOnly()
@Controller('admin')
export class AdminAgencySitesController {
  constructor(
    private readonly sites: AgencySiteReviewService,
    private readonly subscriptions: AgencySubscriptionsService,
  ) {}

  @Get('agency-sites')
  list(@Query() q: AdminAgencySiteListQueryDto): Promise<Paginated<AdminAgencySiteListItem>> {
    return this.sites.list(q);
  }

  @Get('agencies/:id/site')
  site(@Param() p: IdParamDto): Promise<AdminAgencySiteResponse> {
    return this.sites.get(p.id);
  }

  /** APPROVE / REJECT (OPERATOR+), SUSPEND / RESUME (ADMIN+). */
  @Post('agencies/:id/site/decision')
  @HttpCode(HttpStatus.OK)
  decide(
    @Param() p: IdParamDto,
    @Body() dto: AdminAgencySiteDecisionDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<AdminAgencySiteResponse> {
    return this.sites.decide(p.id, dto, admin);
  }

  @Get('agencies/:id/subscriptions')
  listSubscriptions(@Param() p: IdParamDto): Promise<AgencySubscriptionsResponse> {
    return this.subscriptions.list(p.id);
  }

  @Post('agencies/:id/subscriptions')
  @AdminOnly(AdminRole.ADMIN)
  createSubscription(
    @Param() p: IdParamDto,
    @Body() dto: AdminSubscriptionCreateDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<AgencySubscriptionView> {
    return this.subscriptions.create(p.id, dto, admin);
  }

  @Patch('subscriptions/:id')
  @AdminOnly(AdminRole.ADMIN)
  updateSubscription(
    @Param() p: IdParamDto,
    @Body() dto: AdminSubscriptionUpdateDto,
  ): Promise<AgencySubscriptionView> {
    return this.subscriptions.update(p.id, dto);
  }
}
