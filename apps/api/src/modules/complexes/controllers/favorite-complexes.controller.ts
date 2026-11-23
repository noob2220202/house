import type { FavoriteComplexItem, Paginated } from '@house/shared';
import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { UserPrincipal } from '../../../common/auth/principal';
import { CurrentUser } from '../../../common/decorators';
import { THROTTLE } from '../../../common/throttle/throttle.constants';
import { IdParamDto, PaginationQueryDto } from '../dto';
import { ComplexFavoritesService } from '../services/complex-favorites.service';

@ApiTags('complexes')
@Controller('me/favorites/complexes')
export class FavoriteComplexesController {
  constructor(private readonly favorites: ComplexFavoritesService) {}

  @Get()
  list(
    @CurrentUser() user: UserPrincipal,
    @Query() q: PaginationQueryDto,
  ): Promise<Paginated<FavoriteComplexItem>> {
    return this.favorites.list(user.userId, q);
  }

  @Put(':id')
  @Throttle(THROTTLE.WRITE)
  add(
    @CurrentUser() user: UserPrincipal,
    @Param() p: IdParamDto,
  ): Promise<{ complexId: string; favorited: true }> {
    return this.favorites.add(user.userId, p.id);
  }

  @Delete(':id')
  @Throttle(THROTTLE.WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: UserPrincipal, @Param() p: IdParamDto): Promise<void> {
    return this.favorites.remove(user.userId, p.id);
  }
}
