import type { CursorPage, NotificationReadResult, NotificationView } from '@house/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { UserPrincipal } from '../../../common/auth/principal';
import { CurrentUser } from '../../../common/decorators';
import { THROTTLE } from '../../../common/throttle/throttle.constants';
import { NotificationListQueryDto, NotificationReadDto } from '../dto';
import { NotificationsService } from './notifications.service';

/** The logged-in user's in-app notifications (/api/v1/me/notifications). */
@ApiTags('notifications')
@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: UserPrincipal,
    @Query() q: NotificationListQueryDto,
  ): Promise<CursorPage<NotificationView>> {
    return this.notifications.list(user.userId, q);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: UserPrincipal): Promise<{ unread: number }> {
    return { unread: await this.notifications.unreadCount(user.userId) };
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE.WRITE)
  markRead(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: NotificationReadDto,
  ): Promise<NotificationReadResult> {
    return this.notifications.markRead(user.userId, dto);
  }
}
