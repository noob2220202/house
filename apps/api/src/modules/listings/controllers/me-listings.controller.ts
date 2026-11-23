import type { FavoriteListingItem, Paginated, RecentViewItem } from '@house/shared';
import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { UserPrincipal } from '../../../common/auth/principal';
import { CurrentUser } from '../../../common/decorators';
import { THROTTLE } from '../../../common/throttle/throttle.constants';
import {
  IdParamDto,
  PaginationQueryDto,
  RecentViewsClearQueryDto,
  RecentViewsQueryDto,
} from '../dto';
import { FavoritesService } from '../services/favorites.service';
import { RecentViewsService } from '../services/recent-views.service';

@ApiTags('listings')
@Controller('me/favorites/listings')
export class FavoriteListingsController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(
    @CurrentUser() user: UserPrincipal,
    @Query() q: PaginationQueryDto,
  ): Promise<Paginated<FavoriteListingItem>> {
    return this.favorites.list(user.userId, q);
  }

  @Put(':id')
  @Throttle(THROTTLE.WRITE)
  add(
    @CurrentUser() user: UserPrincipal,
    @Param() p: IdParamDto,
  ): Promise<{ listingId: string; favorited: true }> {
    return this.favorites.add(user.userId, p.id);
  }

  @Delete(':id')
  @Throttle(THROTTLE.WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: UserPrincipal, @Param() p: IdParamDto): Promise<void> {
    return this.favorites.remove(user.userId, p.id);
  }
}

@ApiTags('listings')
@Controller('me/recent-views')
export class RecentViewsController {
  constructor(private readonly recent: RecentViewsService) {}

  @Get()
  list(
    @CurrentUser() user: UserPrincipal,
    @Query() q: RecentViewsQueryDto,
  ): Promise<Paginated<RecentViewItem>> {
    return this.recent.list(user.userId, q);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clear(
    @CurrentUser() user: UserPrincipal,
    @Query() q: RecentViewsClearQueryDto,
  ): Promise<void> {
    await this.recent.clear(user.userId, q.targetType);
  }
}
