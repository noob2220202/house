import { AdminPermission } from '@house/shared';
import { Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { Audit, CurrentAdmin } from '../../../common/decorators';
import {
  AdminNotificationListQueryDto,
  AdminSearchQueryDto,
  IdParamDto,
  StatsQueryDto,
  StatsSectionParamDto,
} from '../dto';
import { RequirePermission } from '../permissions.decorator';
import type { AdminNotificationPage, AdminSearchResult, SocialLoginStatus } from '../schemas';
import { AdminNotificationsService } from '../services/admin-notifications.service';
import { AdminSearchService } from '../services/admin-search.service';
import { AdminStatsService } from '../services/admin-stats.service';
import { SocialLoginStatusService } from '../services/social-login-status.service';

/** Topbar search across listings, agencies and members (members masked). Every admin role. */
@ApiTags('admin')
@RequirePermission(AdminPermission.DASHBOARD_READ)
@Controller('admin/search')
export class AdminSearchController {
  constructor(private readonly search: AdminSearchService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  get(@Query() q: AdminSearchQueryDto): Promise<AdminSearchResult> {
    return this.search.search(q);
  }
}

/** The console bell: shared notifications, read state per admin. Every admin role. */
@ApiTags('admin')
@RequirePermission(AdminPermission.DASHBOARD_READ)
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notifications: AdminNotificationsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(
    @Query() q: AdminNotificationListQueryDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<AdminNotificationPage> {
    return this.notifications.list(admin.adminId, q);
  }

  /** Declared before `:id/read` so "read-all" is never parsed as an id. */
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'admin-notification.read-all', resourceType: 'AdminNotification' })
  readAll(
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<{ updated: number; unreadCount: number }> {
    return this.notifications.markAllRead(admin.adminId);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'admin-notification.read', resourceType: 'AdminNotification' })
  read(
    @Param() p: IdParamDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<{ id: string; unreadCount: number }> {
    return this.notifications.markRead(admin.adminId, p.id);
  }
}

/** 통계: traffic · listings · deal-requests · ads, `?days=7|30|90`. Every admin role. */
@ApiTags('admin')
@RequirePermission(AdminPermission.DASHBOARD_READ)
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly stats: AdminStatsService) {}

  @Get(':section')
  @Header('Cache-Control', 'private, no-store')
  get(@Param() p: StatsSectionParamDto, @Query() q: StatsQueryDto): Promise<unknown> {
    return this.stats.get(p.section, q.days);
  }
}

/** Read-only OAuth provider status (카카오 · 네이버 · Google); secrets are never returned. ADMIN+. */
@ApiTags('admin')
@RequirePermission(AdminPermission.SETTINGS_MANAGE)
@Controller('admin/social-login')
export class AdminSocialLoginController {
  constructor(private readonly status: SocialLoginStatusService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  get(): Promise<SocialLoginStatus> {
    return this.status.status();
  }
}
