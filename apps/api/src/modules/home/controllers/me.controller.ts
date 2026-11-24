import type { Paginated } from '@house/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { UserPrincipal } from '../../../common/auth/principal';
import { CurrentUser } from '../../../common/decorators';
import { THROTTLE } from '../../../common/throttle/throttle.constants';
import { IdParamDto, InterestRegionsInputDto, PaginationQueryDto } from '../dto';
import {
  FavoriteAgenciesService,
  type FavoriteAgencyView,
} from '../services/favorite-agencies.service';
import {
  InterestRegionsService,
  type InterestRegionsView,
} from '../services/interest-regions.service';

/** 관심 중개사무소 (same contract as 관심 매물/단지: id list via GET, idempotent PUT/DELETE). */
@ApiTags('home')
@Controller('me/favorites/agencies')
export class FavoriteAgenciesController {
  constructor(private readonly favorites: FavoriteAgenciesService) {}

  @Get()
  list(
    @CurrentUser() user: UserPrincipal,
    @Query() q: PaginationQueryDto,
  ): Promise<Paginated<FavoriteAgencyView>> {
    return this.favorites.list(user.userId, q);
  }

  @Put(':id')
  @Throttle(THROTTLE.WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  add(@CurrentUser() user: UserPrincipal, @Param() p: IdParamDto): Promise<void> {
    return this.favorites.add(user.userId, p.id);
  }

  @Delete(':id')
  @Throttle(THROTTLE.WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: UserPrincipal, @Param() p: IdParamDto): Promise<void> {
    return this.favorites.remove(user.userId, p.id);
  }
}

/** 관심 지역 (signup step + MY). */
@ApiTags('home')
@Controller('me/interest-regions')
export class InterestRegionsController {
  constructor(private readonly interest: InterestRegionsService) {}

  @Get()
  get(@CurrentUser() user: UserPrincipal): Promise<InterestRegionsView> {
    return this.interest.get(user.userId);
  }

  @Put()
  @Throttle(THROTTLE.WRITE)
  put(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: InterestRegionsInputDto,
  ): Promise<InterestRegionsView> {
    return this.interest.put(user.userId, dto);
  }
}
