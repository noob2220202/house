import type { NotificationReadResult } from '@house/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { UserPrincipal } from '../../../common/auth/principal';
import { CurrentUser } from '../../../common/decorators';
import { THROTTLE } from '../../../common/throttle/throttle.constants';
import { NotificationFeedQueryDto, NotificationReadDto, NotificationScopeQueryDto } from '../dto';
import { NotificationsService, type NotificationFeedPage } from './notifications.service';

/**
 * The logged-in user's in-app notifications (/api/v1/me/notifications). `?scope=agency|personal`
 * narrows the feed, the unread count and "read all" to one audience (B5).
 */
@ApiTags('notifications')
@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: UserPrincipal,
    @Query() q: NotificationFeedQueryDto,
  ): Promise<NotificationFeedPage> {
    return this.notifications.list(user.userId, q);
  }

  @Get('unread-count')
  async unreadCount(
    @CurrentUser() user: UserPrincipal,
    @Query() q: NotificationScopeQueryDto,
  ): Promise<{ unread: number }> {
    return { unread: await this.notifications.unreadCount(user.userId, q.scope) };
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE.WRITE)
  markRead(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: NotificationReadDto,
    @Query() q: NotificationScopeQueryDto,
  ): Promise<NotificationReadResult> {
    return this.notifications.markRead(user.userId, dto, q.scope);
  }
}
