import type { NotificationReadResult } from '@house/shared';
import type { UserPrincipal } from '../../../common/auth/principal';
import { NotificationFeedQueryDto, NotificationReadDto, NotificationScopeQueryDto } from '../dto';
import { NotificationsService, type NotificationFeedPage } from './notifications.service';
/**
 * The logged-in user's in-app notifications (/api/v1/me/notifications). `?scope=agency|personal`
 * narrows the feed, the unread count and "read all" to one audience (B5).
 */
export declare class NotificationsController {
    private readonly notifications;
    constructor(notifications: NotificationsService);
    list(user: UserPrincipal, q: NotificationFeedQueryDto): Promise<NotificationFeedPage>;
    unreadCount(user: UserPrincipal, q: NotificationScopeQueryDto): Promise<{
        unread: number;
    }>;
    markRead(user: UserPrincipal, dto: NotificationReadDto, q: NotificationScopeQueryDto): Promise<NotificationReadResult>;
}
