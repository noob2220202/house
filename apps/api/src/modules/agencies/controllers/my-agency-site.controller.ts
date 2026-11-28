import { UserRole, type MyAgencySiteResponse, type SiteSlugAvailability } from '@house/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { UserPrincipal } from '../../../common/auth/principal';
import { CurrentUser, Roles } from '../../../common/decorators';
import { THROTTLE } from '../../../common/throttle/throttle.constants';
import { AgencySiteAvailabilityQueryDto, AgencySiteRequestDto, AgencySiteUpdateDto } from '../dto';
import { AgencySitesService } from '../services/agency-sites.service';

/**
 * 사무소 홈페이지 of the caller's office (/api/v1/agencies/mine/site). Owner of an APPROVED office
 * writes; staff (AGENT) may read. Approval is an admin decision (/admin/agencies/:id/site/decision).
 */
@ApiTags('agencies')
@Controller('agencies/mine/site')
export class MyAgencySiteController {
  constructor(private readonly sites: AgencySitesService) {}

  @Get()
  @Roles(UserRole.AGENT, UserRole.AGENCY_OWNER)
  get(@CurrentUser() user: UserPrincipal): Promise<MyAgencySiteResponse> {
    return this.sites.getMine(user);
  }

  /** Live check for the request form; never fails on a bad slug (`reason` says why). */
  @Get('availability')
  @Roles(UserRole.AGENCY_OWNER)
  availability(
    @CurrentUser() user: UserPrincipal,
    @Query() q: AgencySiteAvailabilityQueryDto,
  ): Promise<SiteSlugAvailability> {
    return this.sites.availability(user, q.slug);
  }

  /** Request, re-request after a rejection, or change a pending request (upsert → 200). */
  @Post()
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.AGENCY_OWNER)
  @Throttle(THROTTLE.WRITE)
  request(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: AgencySiteRequestDto,
  ): Promise<MyAgencySiteResponse> {
    return this.sites.request(user, dto);
  }

  @Patch()
  @Roles(UserRole.AGENCY_OWNER)
  @Throttle(THROTTLE.WRITE)
  update(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: AgencySiteUpdateDto,
  ): Promise<MyAgencySiteResponse> {
    return this.sites.update(user, dto);
  }
}
