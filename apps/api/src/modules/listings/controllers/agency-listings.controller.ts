import {
  UserRole,
  type AgencyListingDetail,
  type CoBrokerRequestResult,
  type ListingSummary,
  type Paginated,
  type PhotoUrls,
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
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { UserPrincipal } from '../../../common/auth/principal';
import { CurrentUser, Roles } from '../../../common/decorators';
import { THROTTLE } from '../../../common/throttle/throttle.constants';
import {
  AgencyListingListQueryDto,
  CoBrokerJoinDto,
  CoBrokerParamDto,
  CreateListingDto,
  IdParamDto,
  ListingPhotosDto,
  ListingStatusChangeDto,
  ListingVerificationDto,
  UpdateListingDto,
} from '../dto';
import { AgencyListingsService } from '../services/agency-listings.service';
import { CoBrokerageService } from '../services/co-brokerage.service';

/** 중개사무소 매물 관리. Membership and ownership are checked in the services (404 if not ours). */
@ApiTags('listings')
@Roles(UserRole.AGENT, UserRole.AGENCY_OWNER)
@Controller('agency/listings')
export class AgencyListingsController {
  constructor(
    private readonly listings: AgencyListingsService,
    private readonly coBrokerage: CoBrokerageService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: UserPrincipal,
    @Query() q: AgencyListingListQueryDto,
  ): Promise<Paginated<ListingSummary>> {
    return this.listings.list(user, q);
  }

  @Post()
  @Throttle(THROTTLE.WRITE)
  create(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: CreateListingDto,
  ): Promise<AgencyListingDetail> {
    return this.listings.create(user, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: UserPrincipal, @Param() p: IdParamDto): Promise<AgencyListingDetail> {
    return this.listings.get(user, p.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserPrincipal,
    @Param() p: IdParamDto,
    @Body() dto: UpdateListingDto,
  ): Promise<AgencyListingDetail> {
    return this.listings.update(user, p.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: UserPrincipal, @Param() p: IdParamDto): Promise<void> {
    return this.listings.remove(user, p.id);
  }

  @Post(':id/publish')
  @Throttle(THROTTLE.WRITE)
  @HttpCode(HttpStatus.OK)
  publish(
    @CurrentUser() user: UserPrincipal,
    @Param() p: IdParamDto,
  ): Promise<AgencyListingDetail> {
    return this.listings.publish(user, p.id);
  }

  @Post(':id/status')
  @Throttle(THROTTLE.WRITE)
  @HttpCode(HttpStatus.OK)
  changeStatus(
    @CurrentUser() user: UserPrincipal,
    @Param() p: IdParamDto,
    @Body() dto: ListingStatusChangeDto,
  ): Promise<AgencyListingDetail> {
    return this.listings.changeStatus(user, p.id, dto);
  }

  @Post(':id/verifications')
  addVerification(
    @CurrentUser() user: UserPrincipal,
    @Param() p: IdParamDto,
    @Body() dto: ListingVerificationDto,
  ): Promise<AgencyListingDetail> {
    return this.listings.addVerification(user, p.id, dto);
  }

  @Put(':id/photos')
  replacePhotos(
    @CurrentUser() user: UserPrincipal,
    @Param() p: IdParamDto,
    @Body() dto: ListingPhotosDto,
  ): Promise<PhotoUrls[]> {
    return this.listings.replacePhotos(user, p.id, dto);
  }

  /** The caller's agency requests to co-broker this listing (공동중개); the primary must accept. */
  @Post(':id/co-brokers')
  @Roles(UserRole.AGENCY_OWNER)
  @Throttle(THROTTLE.WRITE)
  joinCoBroker(
    @CurrentUser() user: UserPrincipal,
    @Param() p: IdParamDto,
    @Body() dto: CoBrokerJoinDto,
  ): Promise<CoBrokerRequestResult> {
    return this.coBrokerage.join(user, p.id, dto);
  }

  /** The primary agency accepts a co-broker request (or takes back a removed agency). */
  @Post(':id/co-brokers/:agencyId/accept')
  @Roles(UserRole.AGENCY_OWNER)
  @Throttle(THROTTLE.WRITE)
  @HttpCode(HttpStatus.OK)
  acceptCoBroker(
    @CurrentUser() user: UserPrincipal,
    @Param() p: CoBrokerParamDto,
  ): Promise<AgencyListingDetail> {
    return this.coBrokerage.accept(user, p.id, p.agencyId);
  }

  /** The primary agency rejects a pending co-broker request. */
  @Post(':id/co-brokers/:agencyId/reject')
  @Roles(UserRole.AGENCY_OWNER)
  @Throttle(THROTTLE.WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  rejectCoBroker(@CurrentUser() user: UserPrincipal, @Param() p: CoBrokerParamDto): Promise<void> {
    return this.coBrokerage.reject(user, p.id, p.agencyId);
  }

  /** The caller's agency leaves the co-brokerage (or cancels its pending request). */
  @Delete(':id/co-brokers')
  @Roles(UserRole.AGENCY_OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  leaveCoBroker(@CurrentUser() user: UserPrincipal, @Param() p: IdParamDto): Promise<void> {
    return this.coBrokerage.leave(user, p.id);
  }

  /** The primary agency removes a co-broker. */
  @Delete(':id/co-brokers/:agencyId')
  @Roles(UserRole.AGENCY_OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCoBroker(@CurrentUser() user: UserPrincipal, @Param() p: CoBrokerParamDto): Promise<void> {
    return this.coBrokerage.removeAgency(user, p.id, p.agencyId);
  }
}
