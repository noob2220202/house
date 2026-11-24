import type { AdminPrincipal } from '../../../common/auth/principal';
import { AdminNotificationListQueryDto, AdminSearchQueryDto, IdParamDto, StatsQueryDto, StatsSectionParamDto } from '../dto';
import type { AdminNotificationPage, AdminSearchResult, SocialLoginStatus } from '../schemas';
import { AdminNotificationsService } from '../services/admin-notifications.service';
import { AdminSearchService } from '../services/admin-search.service';
import { AdminStatsService } from '../services/admin-stats.service';
import { SocialLoginStatusService } from '../services/social-login-status.service';
/** Topbar search across listings, agencies and members (members masked). Every admin role. */
export declare class AdminSearchController {
    private readonly search;
    constructor(search: AdminSearchService);
    get(q: AdminSearchQueryDto): Promise<AdminSearchResult>;
}
/** The console bell: shared notifications, read state per admin. Every admin role. */
export declare class AdminNotificationsController {
    private readonly notifications;
    constructor(notifications: AdminNotificationsService);
    list(q: AdminNotificationListQueryDto, admin: AdminPrincipal): Promise<AdminNotificationPage>;
    /** Declared before `:id/read` so "read-all" is never parsed as an id. */
    readAll(admin: AdminPrincipal): Promise<{
        updated: number;
        unreadCount: number;
    }>;
    read(p: IdParamDto, admin: AdminPrincipal): Promise<{
        id: string;
        unreadCount: number;
    }>;
}
/** 통계: traffic · listings · deal-requests · ads, `?days=7|30|90`. Every admin role. */
export declare class AdminStatsController {
    private readonly stats;
    constructor(stats: AdminStatsService);
    get(p: StatsSectionParamDto, q: StatsQueryDto): Promise<unknown>;
}
/** Read-only OAuth provider status (카카오 · 네이버 · Google); secrets are never returned. ADMIN+. */
export declare class AdminSocialLoginController {
    private readonly status;
    constructor(status: SocialLoginStatusService);
    get(): Promise<SocialLoginStatus>;
}
