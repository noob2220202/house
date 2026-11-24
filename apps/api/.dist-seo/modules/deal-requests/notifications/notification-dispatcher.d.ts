import type { NotificationType } from '@house/shared';
export interface DispatchableNotification {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string | null;
}
/**
 * Out-of-app delivery hook (e-mail, web push …) called after in-app rows are committed. There is
 * deliberately no SMS channel: the platform sends no SMS (owner decision). Implementations must be
 * best-effort and must not throw for a single failed recipient.
 */
export interface NotificationDispatcher {
    dispatch(notifications: readonly DispatchableNotification[]): Promise<void>;
}
export declare const NOTIFICATION_DISPATCHER: unique symbol;
/** Default: in-app only. */
export declare class InAppOnlyNotificationDispatcher implements NotificationDispatcher {
    dispatch(): Promise<void>;
}
